import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_ADDRESS ?? "orders@brimapp.com";
const INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? "replies.brimapp.com";
const APP_URL = process.env.APP_URL ?? "https://brimapp.com";

type LineItem = {
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
};

type SendPOEmailOptions = {
  poId: string;
  poNumber: string;
  supplierName: string;
  supplierEmail: string;
  lineItems: LineItem[];
  currency: string;
  notes?: string | null;
  shopName: string;
};

export function getReplyToAddress(poId: string): string {
  return `po-${poId}@${INBOUND_DOMAIN}`;
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function buildPoEmailHtml(opts: SendPOEmailOptions): string {
  const { poNumber, supplierName, lineItems, currency, notes, shopName } = opts;

  const rows = lineItems
    .map(
      (l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        ${l.product_name}${l.variant_title ? ` — ${l.variant_title}` : ""}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${l.sku ?? "—"}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${l.quantity_ordered}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(l.unit_cost, currency)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(l.line_total, currency)}</td>
    </tr>`,
    )
    .join("");

  const total = lineItems.reduce((s, l) => s + (l.line_total ?? 0), 0);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111;max-width:640px;margin:0 auto;padding:24px;">
  <h2 style="margin-top:0;">Purchase Order ${poNumber}</h2>
  <p>Dear ${supplierName},</p>
  <p>Please find below our purchase order. Kindly confirm receipt and your expected delivery date by replying to this email.</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px;text-align:left;">Product</th>
        <th style="padding:8px;text-align:left;">SKU</th>
        <th style="padding:8px;text-align:center;">Qty</th>
        <th style="padding:8px;text-align:right;">Unit cost</th>
        <th style="padding:8px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="padding:8px;text-align:right;font-weight:bold;">Order total</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">${formatCurrency(total, currency)}</td>
      </tr>
    </tfoot>
  </table>

  ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}

  <p>Please confirm this order by replying to this email with your expected delivery date.</p>

  <p style="margin-top:32px;color:#888;font-size:12px;">
    Sent by ${shopName} via Brim &mdash;
    <a href="${APP_URL}" style="color:#888;">brimapp.com</a>
  </p>
</body>
</html>`;
}

export async function sendPOEmail(opts: SendPOEmailOptions): Promise<string> {
  const replyTo = getReplyToAddress(opts.poId);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.supplierEmail,
    replyTo,
    subject: `Purchase Order ${opts.poNumber} from ${opts.shopName}`,
    html: buildPoEmailHtml(opts),
  });

  if (error) throw new Error(`Resend error: ${error.message}`);

  return data?.id ?? "";
}
