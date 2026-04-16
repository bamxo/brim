const APP_URL = process.env.APP_URL ?? "https://brimapp.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type LineItem = {
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
};

type BuildHtmlOptions = {
  poNumber: string;
  supplierName: string;
  lineItems: LineItem[];
  currency: string;
  notes?: string | null;
  shopName: string;
};

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function buildPoEmailText(opts: BuildHtmlOptions): string {
  const { poNumber, supplierName, lineItems, currency, notes, shopName } = opts;

  const rows = lineItems
    .map((l) => {
      const name = l.product_name + (l.variant_title ? ` — ${l.variant_title}` : "");
      const sku = l.sku ?? "—";
      const qty = String(l.quantity_ordered);
      const cost = formatCurrency(l.unit_cost, currency);
      const total = formatCurrency(l.line_total, currency);
      return `  ${name} | SKU: ${sku} | Qty: ${qty} | Unit: ${cost} | Total: ${total}`;
    })
    .join("\n");

  const orderTotal = lineItems.reduce((s, l) => s + (l.line_total ?? 0), 0);

  return `Purchase Order ${poNumber}

Dear ${supplierName},

Please find below our purchase order. Kindly confirm receipt and your expected delivery date by replying to this email.

${rows}

Order total: ${formatCurrency(orderTotal, currency)}
${notes ? `\nNotes: ${notes}` : ""}
Please confirm this order by replying to this email with your expected delivery date.

Sent by ${shopName} via Brim`;
}

export function buildPoEmailHtml(opts: BuildHtmlOptions): string {
  const { poNumber, supplierName, lineItems, currency, notes, shopName } = opts;

  const rows = lineItems
    .map(
      (l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        ${escapeHtml(l.product_name)}${l.variant_title ? ` — ${escapeHtml(l.variant_title)}` : ""}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${l.sku ? escapeHtml(l.sku) : "—"}</td>
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
  <h2 style="margin-top:0;">Purchase Order ${escapeHtml(poNumber)}</h2>
  <p>Dear ${escapeHtml(supplierName)},</p>
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

  ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}

  <p>Please confirm this order by replying to this email with your expected delivery date.</p>

  <p style="margin-top:32px;color:#888;font-size:12px;">
    Sent by ${escapeHtml(shopName)} via Brim &mdash;
    <a href="${APP_URL}" style="color:#888;">brimapp.com</a>
  </p>
</body>
</html>`;
}
