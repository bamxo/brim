type Attachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

type BuildMessageOptions = {
  from: string;
  to: string;
  subject: string;
  html: string;
  inReplyTo?: string | null;
  references?: string[] | null;
  attachments?: Attachment[];
};

function encodeBase64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeHeader(value: string): string {
  // Encode non-ASCII subject/header values using RFC 2047
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildMimeMessage(opts: BuildMessageOptions): string {
  const boundaryRoot = `brim_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
  const boundaryAlt = `alt_${boundaryRoot}`;
  const hasAttachments = opts.attachments && opts.attachments.length > 0;

  const headers: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `MIME-Version: 1.0`,
  ];

  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references && opts.references.length > 0) {
    headers.push(`References: ${opts.references.join(" ")}`);
  }

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundaryRoot}"`);
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
  }

  const bodyParts: string[] = [];

  const altSection = [
    `--${boundaryAlt}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlToPlain(opts.html),
    ``,
    `--${boundaryAlt}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    opts.html,
    ``,
    `--${boundaryAlt}--`,
  ].join("\r\n");

  if (hasAttachments) {
    bodyParts.push(`--${boundaryRoot}`);
    bodyParts.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
    bodyParts.push(``);
    bodyParts.push(altSection);

    for (const att of opts.attachments!) {
      const b64 = att.content.toString("base64").replace(/(.{76})/g, "$1\r\n");
      bodyParts.push(`--${boundaryRoot}`);
      bodyParts.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      bodyParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      bodyParts.push(`Content-Transfer-Encoding: base64`);
      bodyParts.push(``);
      bodyParts.push(b64);
    }
    bodyParts.push(`--${boundaryRoot}--`);
  } else {
    bodyParts.push(altSection);
  }

  const raw = `${headers.join("\r\n")}\r\n\r\n${bodyParts.join("\r\n")}`;
  return encodeBase64Url(raw);
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type { Attachment };
