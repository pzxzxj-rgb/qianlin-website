import { getDb } from "../../../db";
import { inquiries } from "../../../db/schema";

type InquiryPayload = Record<string, unknown>;

const MAX_BODY_BYTES = 32 * 1024;
const travelerValues = new Set(["1", "2", "3-5", "6+"]);
const durationValues = new Set(["", "3-4", "5-6", "7-10", "10+"]);

function responseError(errorZh: string, errorEn: string, status: number) {
  return Response.json({ error: errorEn, errorZh, errorEn }, { status });
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

export async function POST(request: Request) {
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

  if ([name, rawPhone, wechat, email, location, travelDate, travelers, duration, tourName, places, message, website].some((value) => value === null)) return responseError("部分内容格式不正确，请检查后重试。", "Some fields are invalid or too long.", 400);
  if (website) return responseError("请求内容不正确，请检查后重试。", "Invalid request body.", 400);
  if (!name) return responseError("请填写姓名。", "Please provide your name.", 400);
  if (!rawPhone) return responseError("请填写手机号码。", "Please provide your phone number.", 400);

  const phone = rawPhone.replace(/[\s\-－–—]/g, "");
  if (!/^1[3-9]\d{9}$/.test(phone)) return responseError("请填写有效的大陆手机号码。", "Please provide a valid mainland China mobile number.", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responseError("请填写有效的邮箱地址。", "Please provide a valid email address.", 400);
  if (!travelers || !travelerValues.has(travelers)) return responseError("请选择出行人数。", "Please choose the number of travelers.", 400);
  if (!durationValues.has(duration ?? "") || !isValidTravelDate(travelDate ?? "")) return responseError("出行日期或旅行时长不正确。", "Please check the travel date and duration.", 400);

  const privacyConsent = payload.privacyConsent === true || payload.privacyConsent === "true";
  if (!privacyConsent) return responseError("请阅读并同意隐私政策后提交。", "Please agree to the Privacy Policy before submitting.", 400);

  try {
    const db = await getDb();
    const [inquiry] = await db.insert(inquiries).values({ name, phone, wechat, email: email?.toLowerCase() ?? "", location, travelDate, travelers, duration, tourName, places, message, privacyConsent }).returning({ id: inquiries.id, createdAt: inquiries.createdAt });
    return Response.json({ inquiry }, { status: 201 });
  } catch (error) {
    console.error("Failed to save inquiry", error instanceof Error ? error.name : "UnknownError");
    return responseError("咨询暂时无法保存，请稍后重试。", "We could not save your enquiry. Please try again later.", 500);
  }
}
