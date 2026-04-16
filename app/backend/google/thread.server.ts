import type { gmail_v1 } from "googleapis";
import { getGmailClient } from "./gmail-client.server";

export type ThreadMessage = {
  id: string;
  rfc822MessageId: string | null;
  from: string;
  to: string;
  date: string | null;
  subject: string;
  snippet: string;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: { filename: string; mimeType: string; attachmentId: string | null; size: number }[];
};

export type ThreadPayload = {
  threadId: string;
  messages: ThreadMessage[];
};

export async function fetchThread(
  shopId: string,
  threadId: string,
): Promise<ThreadPayload | null> {
  const gmail = await getGmailClient(shopId);
  try {
    const { data } = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    const messages = (data.messages ?? []).map(parseMessage);
    return { threadId, messages };
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 404) return null;
    throw err;
  }
}

export function parseMessage(msg: gmail_v1.Schema$Message): ThreadMessage {
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const { html, text, attachments } = extractParts(msg.payload ?? undefined);

  return {
    id: msg.id ?? "",
    rfc822MessageId: getHeader("Message-ID") || null,
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date") || null,
    subject: getHeader("Subject"),
    snippet: msg.snippet ?? "",
    bodyHtml: html,
    bodyText: text,
    attachments,
  };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractParts(part: gmail_v1.Schema$MessagePart | undefined): {
  html: string | null;
  text: string | null;
  attachments: ThreadMessage["attachments"];
} {
  let html: string | null = null;
  let text: string | null = null;
  const attachments: ThreadMessage["attachments"] = [];

  const walk = (p?: gmail_v1.Schema$MessagePart) => {
    if (!p) return;
    const mime = p.mimeType ?? "";
    const filename = p.filename ?? "";
    const data = p.body?.data;

    if (filename && p.body?.attachmentId) {
      attachments.push({
        filename,
        mimeType: mime,
        attachmentId: p.body.attachmentId,
        size: p.body.size ?? 0,
      });
      return;
    }

    if (mime === "text/html" && data && !html) {
      html = decodeBase64Url(data);
    } else if (mime === "text/plain" && data && !text) {
      text = decodeBase64Url(data);
    }

    for (const child of p.parts ?? []) walk(child);
  };

  walk(part);
  return { html, text, attachments };
}
