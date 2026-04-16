import type { ActionFunctionArgs } from "react-router";
import * as chrono from "chrono-node";
import supabase from "../../db/supabase.server";
import { getGmailClient } from "../google/gmail-client.server";
import {
  getGoogleAccountByEmail,
  updateHistoryId,
} from "../google/oauth.server";
import { parseMessage } from "../google/thread.server";

type PubSubPayload = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
};

type GmailNotification = {
  emailAddress: string;
  historyId: number | string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();
  let envelope: PubSubPayload;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const data = envelope.message?.data;
  if (!data) return new Response("OK");

  let notification: GmailNotification;
  try {
    notification = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return new Response("Bad inner payload", { status: 400 });
  }

  const account = await getGoogleAccountByEmail(notification.emailAddress);
  if (!account || account.is_disconnected) {
    return new Response("OK");
  }

  const shopId = account.shop_id;
  const startHistoryId =
    account.gmail_history_id ?? String(notification.historyId);

  const gmail = await getGmailClient(shopId);
  const resp = await gmail.users.history
    .list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
    })
    .catch((err) => {
      console.error("Gmail history.list failed:", err);
      return null;
    });
  if (!resp) return new Response("OK");
  const history = resp.data;

  const messageIds = new Set<string>();
  for (const h of history.history ?? []) {
    for (const m of h.messagesAdded ?? []) {
      if (m.message?.id) messageIds.add(m.message.id);
    }
  }

  for (const id of messageIds) {
    try {
      const { data: msg } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });
      const threadId = msg.threadId;
      if (!threadId) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: po } = await (supabase as any)
        .from("purchase_orders")
        .select("id, shop_id, status, gmail_account_email")
        .eq("gmail_thread_id", threadId)
        .eq("shop_id", shopId)
        .single();

      if (!po) continue;

      const parsed = parseMessage(msg);
      const fromHeader = parsed.from.toLowerCase();
      if (fromHeader.includes(account.google_email.toLowerCase())) {
        // Skip our own sent messages
        continue;
      }

      const bodyText = parsed.bodyText ?? parsed.snippet ?? "";
      const { detectedDate, confidence } = extractDate(bodyText);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("supplier_replies").insert({
        purchase_order_id: po.id,
        from_email: extractEmail(parsed.from) ?? parsed.from,
        subject: parsed.subject,
        body_text: bodyText,
        raw_payload: { gmail_message_id: parsed.id, rfc822: parsed.rfc822MessageId },
        detected_date: detectedDate?.toISOString().slice(0, 10) ?? null,
        detected_date_confidence: confidence,
        received_at: new Date().toISOString(),
      });

      const updatePayload: Record<string, unknown> = { status: "supplier_replied" };
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
          : "Reply received — please review the message.",
        action_url: `/app/purchase-orders/${po.id}`,
        is_read: false,
      });
    } catch (err) {
      console.error(`Failed to process Gmail message ${id}:`, err);
    }
  }

  if (history.historyId) {
    await updateHistoryId(shopId, history.historyId);
  }

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
  const components = ["year", "month", "day"] as const;
  const certainCount = components.filter((c) => best.start.isCertain(c)).length;
  let confidence: DateConfidence = "low";
  if (certainCount === 3) confidence = "high";
  else if (certainCount >= 2) confidence = "medium";
  return { detectedDate: date, confidence };
}
