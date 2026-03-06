import { useLoaderData, useNavigate } from "react-router";

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

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string;
  is_urgent: boolean;
  total_amount: number;
  currency: string;
  created_at: string;
  confirmed_delivery_date: string | null;
  suppliers: { name: string } | null;
};

type LoaderData = { purchaseOrders: PurchaseOrder[] };

export default function PurchaseOrdersPage() {
  const { purchaseOrders } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  return (
    <s-page heading="Purchase Orders">
      {purchaseOrders.length === 0 ? (
        <s-section heading="No purchase orders yet">
          <s-paragraph>
            Purchase orders are created automatically when your inventory drops
            below a reorder point. Set up your suppliers and products to get
            started.
          </s-paragraph>
          <s-button
            variant="primary"
            onClick={() => navigate("/app/suppliers")}
          >
            Add a supplier
          </s-button>
        </s-section>
      ) : (
        <s-section>
          <s-table>
            <s-table-header-row>
              <s-table-header>PO number</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Total</s-table-header>
              <s-table-header>Delivery date</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {purchaseOrders.map((po) => (
                <s-table-row
                  key={po.id}
                  clickDelegate={`po-link-${po.id}`}
                >
                  <s-table-cell>
                    <s-stack direction="inline" gap="small">
                      {po.is_urgent && (
                        <s-badge tone="critical">Urgent</s-badge>
                      )}
                      <s-link
                        id={`po-link-${po.id}`}
                        href={`/app/purchase-orders/${po.id}`}
                      >
                        {po.po_number}
                      </s-link>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{po.suppliers?.name ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[po.status] ?? "neutral"}>
                      {STATUS_LABEL[po.status] ?? po.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: po.currency,
                    }).format(po.total_amount)}
                  </s-table-cell>
                  <s-table-cell>
                    {po.confirmed_delivery_date
                      ? new Date(po.confirmed_delivery_date).toLocaleDateString()
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(po.created_at).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}
