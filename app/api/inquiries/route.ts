import { getDb } from "../../../db";
import { inquiries } from "../../../db/schema";

type InquiryPayload = Record<string, unknown>;

function readText(payload: InquiryPayload, key: string, maxLength: number) {
  const value = payload[key];
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function tableErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("no such table") || combined.includes('from "inquiries"')) {
    return "The inquiries table is unavailable. Generate and apply the latest D1 migration before accepting submissions.";
  }

  return message;
}

export async function POST(request: Request) {
  let payload: InquiryPayload;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    payload = body as InquiryPayload;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = readText(payload, "name", 120);
  const country = readText(payload, "country", 120);
  const email = readText(payload, "email", 254);
  const whatsapp = readText(payload, "whatsapp", 80);
  const travelDate = readText(payload, "travelDate", 32);
  const travelers = readText(payload, "travelers", 40);
  const duration = readText(payload, "duration", 40);
  const places = readText(payload, "places", 500);
  const message = readText(payload, "message", 2000);

  if (!name || !country || !email) {
    return Response.json(
      { error: "Name, country and email are required" },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Please provide a valid email" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const [inquiry] = await db
      .insert(inquiries)
      .values({
        name,
        country,
        email,
        whatsapp,
        travelDate,
        travelers,
        duration,
        places,
        message,
      })
      .returning({ id: inquiries.id, createdAt: inquiries.createdAt });

    return Response.json({ inquiry }, { status: 201 });
  } catch (error) {
    return Response.json({ error: tableErrorMessage(error) }, { status: 500 });
  }
}
