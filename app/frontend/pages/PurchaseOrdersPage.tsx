import { useState, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type BadgeTone =
  | "auto"
  | "neutral"
  | "info"
  | "success"
  | "caution"
  | "warning"
  | "critical";

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "neutral",
  sent: "info",
  supplier_replied: "caution",
  confirmed: "success",
  in_transit: "info",
  partially_received: "caution",
  received: "success",
  overdue: "critical",
  dismissed: "neutral",
  send_failed: "critical",
  cancelled: "critical",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  supplier_replied: "Replied",
  confirmed: "Confirmed",
  in_transit: "In transit",
  partially_received: "Partial",
  received: "Received",
  overdue: "Overdue",
  dismissed: "Dismissed",
  send_failed: "Send failed",
  cancelled: "Cancelled",
};

const ALL_STATUSES = [
  "draft",
  "sent",
  "supplier_replied",
  "confirmed",
  "in_transit",
  "partially_received",
  "received",
  "overdue",
  "dismissed",
  "send_failed",
];

type LineItemSummary = {
  product_name: string;
  quantity_ordered: number;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string;
  is_urgent: boolean;
  total_amount: number;
  currency: string;
  created_at: string;
  confirmed_delivery_date: string | null;
  sent_at: string | null;
  suppliers: { name: string } | null;
  purchase_order_line_items: LineItemSummary[];
};

type LoaderData = { purchaseOrders: PurchaseOrder[] };

function formatDate(value: string | null): string {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export default function PurchaseOrdersPage() {
  const { purchaseOrders } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const el = document.getElementById("po-status-filter") as (HTMLElement & { value: string }) | null;
    if (!el) return;
    const handler = () => setStatusFilter(el.value);
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  }, []);

  const filtered =
    statusFilter === "all"
      ? purchaseOrders
      : purchaseOrders.filter((po) => po.status === statusFilter);

  return (
    <TitleBar heading="Purchase Orders" subtitle="">
      {purchaseOrders.length > 0 && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => navigate("/app/purchase-orders/new")}
        >
          Create New PO
        </s-button>
      )}

      {purchaseOrders.length === 0 ? (
        <s-section>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "48px 16px", textAlign: "center" }}>
            <div style={{ width: "130px", height: "130px", borderRadius: "50%", background: "#f1f1f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="80" height="80" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11Zm1.5 0v7h3.25a.75.75 0 0 1 .75.75 1.5 1.5 0 0 0 3 0 .75.75 0 0 1 .75-.75h3.25v-7h-11Zm11 8.5h-2.55a3 3 0 0 1-5.9 0H4.5v2.5h11V13Z" fill="#5C5F62" />
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "600", color: "#1a1a1a" }}>
              No purchase orders yet
            </h2>
            <s-paragraph color="subdued">
              Manage your inventory restocks by creating your first purchase order.
            </s-paragraph>
            <button
              onClick={() => navigate("/app/purchase-orders/new")}
              style={{ backgroundColor: "#008060", color: "#fff", border: "none", borderRadius: "6px", padding: "10px 20px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
            >
              Create purchase order
            </button>
            <s-link href="/app/products">Set reorder rule</s-link>
          </div>
        </s-section>
      ) : (
        <s-section>
          <s-select
            id="po-status-filter"
            label="Filter by Status"
            name="statusFilter"
            value={statusFilter}
          >
            <s-option value="all">All</s-option>
            {ALL_STATUSES.map((s) => (
              <s-option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}
              </s-option>
            ))}
          </s-select>

          <s-table>
            <s-table-header-row>
              <s-table-header>PO Number</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>Quantity</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Date Sent</s-table-header>
              <s-table-header>Expected Delivery</s-table-header>
              <s-table-header>Total</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {filtered.map((po) => {
              const items = po.purchase_order_line_items ?? [];
              const firstProduct = items[0]?.product_name ?? "—";
              const extraCount = items.length - 1;
              const totalQty = items.reduce(
                (sum, item) => sum + item.quantity_ordered,
                0,
              );
              const tooltipId = `product-tooltip-${po.id}`;

              return (
                <s-table-row key={po.id} clickDelegate={`po-link-${po.id}`}>
                  <s-table-cell>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      {po.is_urgent && (
                        <s-badge tone="critical">Urgent</s-badge>
                      )}
                      <s-link
                        id={`po-link-${po.id}`}
                        href={`/app/purchase-orders/${po.id}`}
                      >
                        {po.po_number}
                      </s-link>
                    </div>
                  </s-table-cell>
                  <s-table-cell>{po.suppliers?.name ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span>{firstProduct}</span>
                      {extraCount > 0 && (
                        <>
                          <s-icon
                            type="info"
                            size="small"
                            interest-for={tooltipId}
                          />
                          <s-tooltip id={tooltipId}>
                            {items
                              .map(
                                (item) =>
                                  `${item.product_name} × ${item.quantity_ordered}`,
                              )
                              .join(", ")}
                          </s-tooltip>
                        </>
                      )}
                    </div>
                  </s-table-cell>
                  <s-table-cell>{items.length > 0 ? totalQty : "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[po.status] ?? "neutral"}>
                      {STATUS_LABEL[po.status] ?? po.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{formatDate(po.sent_at)}</s-table-cell>
                  <s-table-cell>
                    {formatDate(po.confirmed_delivery_date)}
                  </s-table-cell>
                  <s-table-cell>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: po.currency,
                    }).format(po.total_amount)}
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>

            {filtered.length === 0 && (
              <s-paragraph>No purchase orders match the selected filter.</s-paragraph>
            )}
          </s-section>
      )}
    </TitleBar>
  );
}
