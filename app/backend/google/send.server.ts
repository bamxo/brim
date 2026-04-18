import { getGmailClient } from "./gmail-client.server";
import { buildMimeMessage, type Attachment } from "./mime.server";
import { getGoogleAccount } from "./oauth.server";

type SendOptions = {
  shopId: string;
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
  threadId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
};

export type SendResult = {
  threadId: string;
  messageId: string;
  rfc822MessageId: string | null;
  fromEmail: string;
};

export async function sendGmailMessage(opts: SendOptions): Promise<SendResult> {
  const account = await getGoogleAccount(opts.shopId);
  if (!account) throw new Error("No Gmail account connected for shop");

  const gmail = await getGmailClient(opts.shopId);

  const raw = buildMimeMessage({
    from: account.google_email,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    inReplyTo: opts.inReplyTo ?? null,
    references: opts.references ?? null,
    attachments: opts.attachments,
  });

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: opts.threadId ?? undefined,
    },
  });

  let rfc822MessageId: string | null = null;
  if (data.id) {
    try {
      const { data: msg } = await gmail.users.messages.get({
        userId: "me",
        id: data.id,
        format: "metadata",
        metadataHeaders: ["Message-ID"],
      });
      const header = msg.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "message-id",
      );
      rfc822MessageId = header?.value ?? null;
    } catch {
      // Ignore — Message-ID header is a nice-to-have for reply threading
    }
  }

  return {
    threadId: data.threadId ?? "",
    messageId: data.id ?? "",
    rfc822MessageId,
    fromEmail: account.google_email,
  };
}
