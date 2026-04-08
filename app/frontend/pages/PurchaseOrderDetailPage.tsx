import { useState } from "react";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type LineItem = {
  id: string;
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
  status: string;
};

type LoaderData = {
  po: {
    id: string;
    po_number: string;
    status: string;
    currency: string;
    total_amount: number;
    notes: string | null;
    confirmed_delivery_date: string | null;
    suppliers: { id: string; name: string; email: string; phone: string | null } | null;
    purchase_order_line_items: LineItem[];
  };
  pdfDataUrl: string | null;
};

type ActionData = { success?: boolean; error?: string | null };

export default function PurchaseOrderDetailPage() {
  const { po, pdfDataUrl } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const isDraft = po.status === "draft";
  const [pdfExpanded, setPdfExpanded] = useState(false);

  const handleDownloadPdf = () => {
    if (!pdfDataUrl) return;
    const a = document.createElement("a");
    a.href = pdfDataUrl;
    a.download = `${po.po_number}.pdf`;
    a.click();
  };

  const handleSend = (sendMethod: string) => {
    const fd = new FormData();
    fd.append("intent", "mark-sent");
    fd.append("send_method", sendMethod);
    submit(fd, { method: "post" });
  };

  const handleDismiss = () => {
    if (!confirm("Dismiss this purchase order?")) return;
    const fd = new FormData();
    fd.append("intent", "dismiss");
    submit(fd, { method: "post" });
  };

  return (
    <TitleBar heading={po.po_number} breadcrumbs={[{ label: "Purchase Orders", href: "/app/purchase-orders" }]}>
      {isDraft && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => handleSend("brim")}
        >
          Send via Brim
        </s-button>
      )}
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/purchase-orders")}
      >
        Back
      </s-button>
      {actionData?.error && (
        <s-banner tone="critical" heading="Error">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Order details" slot="aside">
        <s-paragraph>
          <s-text>Supplier: </s-text>
          <s-text>{po.suppliers?.name ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Supplier email: </s-text>
          <s-text>{po.suppliers?.email ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Status: </s-text>
          <s-text>{po.status}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Total: </s-text>
          <s-text>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: po.currency,
            }).format(po.total_amount)}
          </s-text>
        </s-paragraph>
        {po.confirmed_delivery_date && (
          <s-paragraph>
            <s-text>Delivery date: </s-text>
            <s-text>
              {new Date(po.confirmed_delivery_date).toLocaleDateString()}
            </s-text>
          </s-paragraph>
        )}
        {po.notes && (
          <s-paragraph>
            <s-text>Notes: </s-text>
            <s-text>{po.notes}</s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Line items">
        <s-table>
          <s-table-header-row>
            <s-table-header>Product</s-table-header>
            <s-table-header>SKU</s-table-header>
            <s-table-header>Qty</s-table-header>
            <s-table-header>Unit cost</s-table-header>
            <s-table-header>Line total</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {po.purchase_order_line_items.map((line) => (
              <s-table-row key={line.id}>
                <s-table-cell>
                  {line.product_name}
                  {line.variant_title ? ` — ${line.variant_title}` : ""}
                </s-table-cell>
                <s-table-cell>{line.sku ?? "—"}</s-table-cell>
                <s-table-cell>
                  {isDraft ? (
                    <s-number-field
                      name={`qty-${line.id}`}
                      label="Quantity"
                      label-hidden
                      min={0}
                      value={String(line.quantity_ordered)}
                    />
                  ) : (
                    String(line.quantity_ordered)
                  )}
                </s-table-cell>
                <s-table-cell>
                  {line.unit_cost != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: po.currency,
                      }).format(line.unit_cost)
                    : "—"}
                </s-table-cell>
                <s-table-cell>
                  {line.line_total != null
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: po.currency,
                      }).format(line.line_total)
                    : "—"}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
        {isDraft && (
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() => {
                const fd = new FormData();
                fd.append("intent", "update-quantities");
                for (const line of po.purchase_order_line_items) {
                  fd.append("line_id", line.id);
                  const input = document.querySelector<HTMLInputElement>(
                    `[name="qty-${line.id}"]`,
                  );
                  fd.append("quantity", input?.value ?? String(line.quantity_ordered));
                }
                submit(fd, { method: "post" });
              }}
            >
              Update quantities
            </s-button>
          </s-stack>
        )}
      </s-section>

      {pdfDataUrl && (
        <s-section heading="Document">
          {!pdfExpanded ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "4px 0",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "52px",
                  border: "1px solid #d9d9d9",
                  borderRadius: "4px",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#fff",
                }}
              >
                <iframe
                  src={pdfDataUrl}
                  style={{
                    width: "612px",
                    height: "792px",
                    transform: "scale(0.065)",
                    transformOrigin: "top left",
                    border: "none",
                    pointerEvents: "none",
                  }}
                  tabIndex={-1}
                  title="PDF thumbnail"
                />
              </div>
              <span style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>
                PDF Preview
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <s-button onClick={() => setPdfExpanded(true)}>
                  Expand
                </s-button>
                <s-button onClick={handleDownloadPdf}>
                  Download
                </s-button>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <s-button onClick={() => setPdfExpanded(false)}>
                  Collapse
                </s-button>
                <s-button onClick={handleDownloadPdf}>
                  Download
                </s-button>
              </div>
              <iframe
                src={pdfDataUrl}
                style={{
                  width: "100%",
                  height: "800px",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                }}
                title={`PDF preview for ${po.po_number}`}
              />
            </>
          )}
        </s-section>
      )}

      {isDraft && (
        <s-section heading="Send this order" slot="aside">
          <s-paragraph>
            Choose how to send this purchase order to{" "}
            {po.suppliers?.name ?? "your supplier"}.
          </s-paragraph>
          <s-stack direction="block" gap="base">
            <s-button variant="primary" onClick={() => handleSend("brim")}>
              Send via Brim email
            </s-button>
            <s-button onClick={() => handleSend("clipboard")}>
              Copy to clipboard
            </s-button>
            <s-button disabled>
              Send via Gmail (coming soon)
            </s-button>
          </s-stack>
          <s-divider />
          <s-button tone="critical" onClick={handleDismiss}>
            Dismiss order
          </s-button>
        </s-section>
      )}
    </TitleBar>
  );
}
