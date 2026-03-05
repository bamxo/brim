import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: purchaseOrders, error } = await (supabase as any)
    .from("purchase_orders")
    .select(
      `
      id, po_number, status, is_urgent,
      total_amount, currency, created_at,
      confirmed_delivery_date,
      suppliers (name)
    `,
    )
    .eq("shop_id", shop.id)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return { purchaseOrders: purchaseOrders ?? [] };
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

export default function PurchaseOrders() {
  const { purchaseOrders } = useLoaderData<typeof loader>();
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
              {purchaseOrders.map((po: PurchaseOrder) => (
                <s-table-row
                  key={po.id}
                  clickDelegate={`po-link-${po.id}`}
                >
                  <s-table-cell>
                    <s-link id={`po-link-${po.id}`} href={`/app/purchase-orders/${po.id}`}>
                      {po.is_urgent ? "🔴 " : ""}
                      {po.po_number}
                    </s-link>
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
