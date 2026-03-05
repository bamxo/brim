import type { ActionFunctionArgs } from "react-router";
import { Resend } from "resend";
import * as chrono from "chrono-node";
import supabase from "../supabase.server";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Resend Inbound Email webhook (email.received event).
 *
 * Resend POSTs JSON with the structure:
 *   { type: "email.received", data: { from, to[], subject, email_id, ... } }
 *
 * NOTE: Resend's inbound webhook currently provides only email metadata
 * (from, to, subject). The full body text is not included in the payload.
 * As a result, chrono-node date extraction will have no text to parse until
 * Resend adds body content to their inbound payload.
 * When that happens, replace the bodyText fallback below with data.html or
 * data.text from the payload.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  // Read the raw body string first — required for signature verification
  const rawBody = await request.text();

  // Verify the webhook signature if a secret is configured
  if (webhookSecret) {
    try {
      resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: request.headers.get("svix-id") ?? "",
          timestamp: request.headers.get("svix-timestamp") ?? "",
          signature: request.headers.get("svix-signature") ?? "",
        },
        webhookSecret,
      });
    } catch {
      console.error("Inbound email: invalid webhook signature");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: {
      email_id: string;
      from: string;
      to: string[];
      subject: string;
      // body fields not yet provided by Resend inbound webhook
    };
  };

  if (event.type !== "email.received") {
    return new Response("OK");
  }

  const { from, to, subject } = event.data;

  // Resend delivers to[] as plain addresses (no display names)
  const toEmail = to?.[0]?.toLowerCase().trim() ?? null;
  const fromEmail = extractEmail(from) ?? from;

  if (!toEmail) {
    console.error("Inbound email: empty to address in payload");
    return new Response("OK");
  }

  // Look up the PO by reply_to_address
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po, error } = await (supabase as any)
    .from("purchase_orders")
    .select("id, shop_id, status")
    .eq("reply_to_address", toEmail)
    .single();

  if (error || !po) {
    console.error(`Inbound email: no PO found for address ${toEmail}`);
    return new Response("OK");
  }

  // Body text is not available in Resend's current inbound payload.
  // Use the subject line as a fallback for date extraction; this covers
  // cases like "Re: PO-20250305-001 — delivery on March 10".
  const bodyText = subject ?? "";
  const { detectedDate, confidence } = extractDate(bodyText);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("supplier_replies").insert({
    purchase_order_id: po.id,
    from_email: fromEmail,
    subject,
    body_text: bodyText,
    raw_payload: event.data,
    detected_date: detectedDate?.toISOString().slice(0, 10) ?? null,
    detected_date_confidence: confidence,
    received_at: new Date().toISOString(),
  });

  const updatePayload: Record<string, unknown> = {
    status: "supplier_replied",
  };
  if (detectedDate && (confidence === "high" || confidence === "medium")) {
    updatePayload.confirmed_delivery_date = detectedDate.toISOString().slice(0, 10);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("purchase_orders")
    .update(updatePayload)
    .eq("id", po.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("notifications").insert({
    shop_id: po.shop_id,
    purchase_order_id: po.id,
    type: "supplier_replied",
    title: "Supplier replied",
    body: detectedDate
      ? `Delivery date detected: ${detectedDate.toLocaleDateString()}`
      : "Reply received — please review and confirm the delivery date.",
    action_url: `/app/purchase-orders/${po.id}`,
    is_read: false,
  });

  return new Response("OK");
};

function extractEmail(raw: string): string | null {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  const plain = raw.trim();
  if (plain.includes("@")) return plain.toLowerCase();
  return null;
}

type DateConfidence = "high" | "medium" | "low" | "none";

function extractDate(text: string): {
  detectedDate: Date | null;
  confidence: DateConfidence;
} {
  if (!text) return { detectedDate: null, confidence: "none" };

  const results = chrono.parse(text, new Date(), { forwardDate: true });
  if (results.length === 0) return { detectedDate: null, confidence: "none" };

  const best = results[0];
  const date = best.start.date();

  const dateComponents = ["year", "month", "day"] as const;
  const certainCount = dateComponents.filter((c) => best.start.isCertain(c)).length;

  let confidence: DateConfidence = "low";
  if (certainCount === 3) confidence = "high";
  else if (certainCount >= 2) confidence = "medium";

  return { detectedDate: date, confidence };
}
