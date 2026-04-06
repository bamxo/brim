import { useLoaderData, useNavigate } from "react-router";
import TitleBar from "../components/Header/TitleBar";

type AtRiskProduct = {
  ruleId: string;
  productId: string;
  title: string;
  sku: string | null;
  currentStock: number;
  reorderPoint: number;
  imageUrl: string | null;
  supplierName: string | null;
};

type UnconfirmedPO = {
  id: string;
  poNumber: string;
  sentAt: string;
  daysSinceSent: number;
  supplierName: string | null;
  supplierId: string | null;
};

type OverdueDelivery = {
  id: string;
  poNumber: string;
  expectedDelivery: string;
  supplierName: string | null;
  supplierId: string | null;
};

type LoaderData = {
  shopName: string;
  stats: {
    openPOs: number;
    suppliers: number;
    products: number;
    atRiskCount: number;
  };
  atRiskProducts: AtRiskProduct[];
  unconfirmedPOs: UnconfirmedPO[];
  overdueDeliveries: OverdueDelivery[];
};

export default function DashboardPage() {
  const { shopName, stats, atRiskProducts, unconfirmedPOs, overdueDeliveries } =
    useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const hasAlerts =
    atRiskProducts.length > 0 ||
    unconfirmedPOs.length > 0 ||
    overdueDeliveries.length > 0;

  return (
    <TitleBar heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/purchase-orders")}
      >
        View purchase orders
      </s-button>

      {/* Stats sidebar */}
      <s-section heading="Overview" slot="aside">
        <s-paragraph>
          <s-text>Open purchase orders: </s-text>
          <s-text>{String(stats.openPOs)}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Active suppliers: </s-text>
          <s-text>{String(stats.suppliers)}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Products tracked: </s-text>
          <s-text>{String(stats.products)}</s-text>
        </s-paragraph>
        {stats.atRiskCount > 0 && (
          <s-paragraph>
            <s-text>
              <s-icon type="alert-triangle" tone="warning" />
            </s-text>
            <s-text> {String(stats.atRiskCount)} product{stats.atRiskCount !== 1 ? "s" : ""} at risk</s-text>
          </s-paragraph>
        )}
      </s-section>

      {/* Welcome / feature cards — shown when no alerts exist */}
      {!hasAlerts && (
        <s-section heading={`Welcome to Brim, ${shopName}`}>
          <s-paragraph>
            Brim automates your purchase order management. Set up your
            suppliers and configure reorder rules on your products to get
            started.
          </s-paragraph>
          <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
            {/* Suppliers card */}
            <s-box border="base" borderRadius="base" padding="base">
              <s-stack direction="block" gap="base">
                <s-icon type="organization" />
                <s-heading>Manage Suppliers</s-heading>
                <s-paragraph>
                  Add your suppliers with contact details and configure which
                  products they supply.
                </s-paragraph>
                <s-button onClick={() => navigate("/app/suppliers")}>
                  Go to Suppliers
                </s-button>
              </s-stack>
            </s-box>

            {/* Products card */}
            <s-box border="base" borderRadius="base" padding="base">
              <s-stack direction="block" gap="base">
                <s-icon type="inventory" />
                <s-heading>Configure Products</s-heading>
                <s-paragraph>
                  Set reorder points and quantities on your synced Shopify
                  products to automate ordering.
                </s-paragraph>
                <s-button onClick={() => navigate("/app/products")}>
                  Go to Products
                </s-button>
              </s-stack>
            </s-box>

            {/* Purchase Orders card */}
            <s-box border="base" borderRadius="base" padding="base">
              <s-stack direction="block" gap="base">
                <s-icon type="order" />
                <s-heading>Purchase Orders</s-heading>
                <s-paragraph>
                  Review and send draft purchase orders. Track confirmations
                  and deliveries in one place.
                </s-paragraph>
                <s-button onClick={() => navigate("/app/purchase-orders")}>
                  Go to Purchase Orders
                </s-button>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>
      )}

      {/* Alert: products at or below reorder threshold */}
      {atRiskProducts.length > 0 && (
        <s-section heading="Products Below Reorder Point">
          <s-banner
            tone="warning"
            heading={`${atRiskProducts.length} product${atRiskProducts.length !== 1 ? "s are" : " is"} at or below the reorder threshold`}
          />
          <s-table>
            <s-table-header-row>
              <s-table-header></s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Stock</s-table-header>
              <s-table-header>Reorder at</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {atRiskProducts.map((p) => (
                <s-table-row key={p.ruleId}>
                  <s-table-cell>
                    <s-thumbnail
                      src={p.imageUrl ?? undefined}
                      alt={p.title}
                      size="small"
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-link href={`/app/products/${p.productId}`}>
                      {p.title}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{p.sku ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone="critical">{String(p.currentStock)}</s-badge>
                  </s-table-cell>
                  <s-table-cell>{String(p.reorderPoint)}</s-table-cell>
                  <s-table-cell>{p.supplierName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-button
                      variant="primary"
                      onClick={() =>
                        navigate(`/app/products/${p.productId}`)
                      }
                    >
                      View
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {/* Alert: POs sent with no confirmation */}
      {unconfirmedPOs.length > 0 && (
        <s-section heading="Awaiting Supplier Confirmation">
          <s-banner
            tone="warning"
            heading={`${unconfirmedPOs.length} purchase order${unconfirmedPOs.length !== 1 ? "s have" : " has"} been sent with no response`}
          />
          <s-table>
            <s-table-header-row>
              <s-table-header>PO Number</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header>Sent</s-table-header>
              <s-table-header>Waiting</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {unconfirmedPOs.map((po) => (
                <s-table-row
                  key={po.id}
                  clickDelegate={`unconf-link-${po.id}`}
                >
                  <s-table-cell>
                    <s-link
                      id={`unconf-link-${po.id}`}
                      href={`/app/purchase-orders/${po.id}`}
                    >
                      {po.poNumber}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{po.supplierName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {new Date(po.sentAt).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="warning">
                      {String(po.daysSinceSent)} day{po.daysSinceSent !== 1 ? "s" : ""}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      onClick={() =>
                        navigate(`/app/purchase-orders/${po.id}`)
                      }
                    >
                      Follow up
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {/* Alert: confirmed POs with past delivery date */}
      {overdueDeliveries.length > 0 && (
        <s-section heading="Overdue Deliveries">
          <s-banner
            tone="critical"
            heading={`${overdueDeliveries.length} delivery${overdueDeliveries.length !== 1 ? " dates have" : " date has"} passed without confirmation`}
          />
          <s-table>
            <s-table-header-row>
              <s-table-header>PO Number</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header>Expected delivery</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {overdueDeliveries.map((po) => (
                <s-table-row
                  key={po.id}
                  clickDelegate={`overdue-link-${po.id}`}
                >
                  <s-table-cell>
                    <s-link
                      id={`overdue-link-${po.id}`}
                      href={`/app/purchase-orders/${po.id}`}
                    >
                      {po.poNumber}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{po.supplierName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {new Date(po.expectedDelivery).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone="critical">Overdue</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      tone="critical"
                      onClick={() =>
                        navigate(`/app/purchase-orders/${po.id}`)
                      }
                    >
                      Contact supplier
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {/* When there are alerts, show a compact get-started section too */}
      {hasAlerts && (
        <s-section heading="Quick actions" slot="aside">
          <s-stack direction="block" gap="base">
            <s-button onClick={() => navigate("/app/suppliers")}>
              Manage suppliers
            </s-button>
            <s-button onClick={() => navigate("/app/products")}>
              Configure products
            </s-button>
            <s-button onClick={() => navigate("/app/purchase-orders")}>
              All purchase orders
            </s-button>
          </s-stack>
        </s-section>
      )}
    </TitleBar>
  );
}
