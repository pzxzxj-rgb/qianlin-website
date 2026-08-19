import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { inquiries, tenantLegalPages, tenantQuotas } from "../../db/schema";
import { verifyTurnstileToken } from "../security/turnstile";
import { isValidMainlandPhone, normalizeMainlandPhone } from "./validateMainlandPhone";
import { createInquirySyncJob } from "./syncService";
import type { ResolvedTenant } from "../tenancy/types";

type InquiryPayload = Record<string, unknown>;

const MAX_BODY_BYTES = 32 * 1024;
const travelerValues = new Set(["1", "2", "3-5", "6+"]);
const durationValues = new Set(["", "3-4", "5-6", "7-10", "10+"]);

function responseError(errorZh: string, errorEn: string, status: number) {
  return Response.json({ error: errorEn, errorZh, errorEn }, { status, headers: { "Cache-Control": "no-store" } });
}

function unavailableResponse() {
  return responseError("咨询暂时无法保存，请稍后重试。", "We could not save your enquiry. Please try again later.", 503);
}

function readText(payload: InquiryPayload, key: string, maxLength: number): string | null {
  const value = payload[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

function chinaToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidTravelDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < chinaToday()) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleInquiry(request: Request, tenant: ResolvedTenant | null) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return responseError("请求格式不正确，请稍后重试。", "Please send the enquiry as JSON.", 415);

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return responseError("提交内容过长，请精简后重试。", "Your enquiry is too large. Please shorten it and try again.", 413);
    return responseError("请求内容不正确，请检查后重试。", "Invalid request body.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return responseError("请求内容不正确，请检查后重试。", "Invalid request body.", 400);

  const payload = body as InquiryPayload;
  const allowedFields = new Set(["name", "phone", "wechat", "email", "location", "travelDate", "travelers", "duration", "tourName", "places", "message", "website", "privacyConsent", "turnstileToken", "submissionId"]);
  if (Object.keys(payload).some((key) => !allowedFields.has(key))) return responseError("请求包含不支持的字段。", "The enquiry contains unsupported fields.", 400);
  const name = readText(payload, "name", 80);
  const rawPhone = readText(payload, "phone", 20);
  const wechat = readText(payload, "wechat", 80);
  const email = readText(payload, "email", 254);
  const location = readText(payload, "location", 100);
  const travelDate = readText(payload, "travelDate", 10);
  const travelers = readText(payload, "travelers", 8);
  const duration = readText(payload, "duration", 8);
  const tourName = readText(payload, "tourName", 160);
  const places = readText(payload, "places", 500);
  const message = readText(payload, "message", 2000);
  const website = readText(payload, "website", 200);
  const turnstileToken = readText(payload, "turnstileToken", 4096);
  const submissionId = readText(payload, "submissionId", 36);

  if ([name, rawPhone, wechat, email, location, travelDate, travelers, duration, tourName, places, message, website, turnstileToken, submissionId].some((value) => value === null)) return responseError("部分内容格式不正确，请检查后重试。", "Some fields are invalid or too long.", 400);
  if (website) return responseError("请求内容不正确，请检查后重试。", "Invalid request body.", 400);
  if (!name) return responseError("请填写姓名。", "Please provide your name.", 400);
  if (!rawPhone) return responseError("请填写手机号码。", "Please provide your phone number.", 400);
  if (!submissionId || !isUuid(submissionId)) return responseError("提交编号无效，请刷新页面后重试。", "The submission ID is invalid. Please refresh and try again.", 400);

  const phone = normalizeMainlandPhone(rawPhone);
  if (!isValidMainlandPhone(phone)) return responseError("请填写有效的中国大陆手机号码。", "Please provide a valid mainland China mobile number.", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responseError("请填写有效的邮箱地址。", "Please provide a valid email address.", 400);
  if (!travelers || !travelerValues.has(travelers)) return responseError("请选择出行人数。", "Please choose the number of travelers.", 400);
  if (!durationValues.has(duration ?? "") || !isValidTravelDate(travelDate ?? "")) return responseError("出行日期或旅行时长不正确。", "Please check the travel date and duration.", 400);
  if (!(payload.privacyConsent === true || payload.privacyConsent === "true")) return responseError("请阅读并同意隐私政策后提交。", "Please agree to the Privacy Policy before submitting.", 400);
  if (!tenant) return unavailableResponse();

  const turnstile = await verifyTurnstileToken(turnstileToken ?? "", request);
  if (!turnstile.ok) {
    return turnstile.code === "not_configured"
      ? responseError("咨询安全校验尚未完成配置，请联系网站管理员。", "Inquiry security verification is not configured.", 503)
      : responseError("安全校验未通过，请刷新后重试。", "Security verification failed. Please try again.", 400);
  }

  const normalizedValues = {
    name,
    wechat: wechat ?? "",
    email: email?.toLowerCase() ?? "",
    location: location ?? "",
    travelDate: travelDate ?? "",
    travelers: travelers ?? "",
    duration: duration ?? "",
    tourName: tourName ?? "",
    places: places ?? "",
    message: message ?? "",
  };

  try {
    const db = await getDb();
    const [policy] = await db.select({ policyVersion: tenantLegalPages.policyVersion, privacyZh: tenantLegalPages.privacyZh, privacyEn: tenantLegalPages.privacyEn }).from(tenantLegalPages).where(eq(tenantLegalPages.tenantId, tenant.id)).limit(1);
    if (!policy || !policy.policyVersion.trim() || (!policy.privacyZh.trim() && !policy.privacyEn.trim())) {
      return responseError("隐私政策尚未完成配置，暂时无法提交咨询。", "The privacy policy is not configured.", 503);
    }
    const [quota] = await db.select({ inquiryLimit: tenantQuotas.inquiryLimit }).from(tenantQuotas).where(eq(tenantQuotas.tenantId, tenant.id)).limit(1);
    if (quota) {
      const [usage] = await db.select({ value: count(inquiries.id) }).from(inquiries).where(and(eq(inquiries.tenantId, tenant.id), isNull(inquiries.anonymizedAt)));
      if (Number(usage?.value ?? 0) >= quota.inquiryLimit) return responseError("当前网站已达到咨询接收额度，请稍后再试。", "This site has reached its enquiry limit. Please try again later.", 429);
    }
    const retentionDate = new Date();
    retentionDate.setUTCDate(retentionDate.getUTCDate() + 180);
    let inquiry: { id: number; createdAt: string } | undefined;
    try {
      [inquiry] = await db.insert(inquiries).values({ tenantId: tenant.id, submissionId, phone, ...normalizedValues, privacyConsent: true, privacyConsentAt: new Date().toISOString(), privacyPolicyVersion: policy.policyVersion, retentionUntil: retentionDate.toISOString() }).returning({ id: inquiries.id, createdAt: inquiries.createdAt });
    } catch (error) {
      const [existing] = await db.select({ id: inquiries.id, createdAt: inquiries.createdAt }).from(inquiries).where(and(eq(inquiries.tenantId, tenant.id), eq(inquiries.submissionId, submissionId))).limit(1);
      if (!existing) throw error;
      let existingJob: Awaited<ReturnType<typeof createInquirySyncJob>> | null = null;
      try {
        existingJob = await createInquirySyncJob(tenant.id, existing.id);
      } catch (syncError) {
        console.error("Failed to create duplicate inquiry sync state", syncError instanceof Error ? syncError.name : "UnknownError");
      }
      return Response.json({ inquiry: existing, sync: existingJob ? { status: existingJob.status, provider: existingJob.provider } : null, duplicate: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
    if (!inquiry) return unavailableResponse();
    let latestJob: Awaited<ReturnType<typeof createInquirySyncJob>> | null = null;
    try {
      latestJob = await createInquirySyncJob(tenant.id, inquiry.id);
    } catch (syncError) {
      console.error("Failed to create inquiry sync state", syncError instanceof Error ? syncError.name : "UnknownError");
    }
    return Response.json({ inquiry, sync: latestJob ? { status: latestJob.status, provider: latestJob.provider } : null }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to save inquiry", error instanceof Error ? error.name : "UnknownError");
    return unavailableResponse();
  }
}
