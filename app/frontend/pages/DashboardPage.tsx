import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import cloudSvg from "../assets/cloud.svg";
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

type DraftPO = {
  id: string;
  poNumber: string;
  createdAt: string;
  supplierName: string | null;
  supplierId: string | null;
};

type ArrivingPO = {
  id: string;
  poNumber: string;
  expectedDelivery: string;
  supplierName: string | null;
  supplierId: string | null;
};

type StockLevel = {
  productId: string;
  title: string;
  currentStock: number;
  reorderPoint: number;
  daysEstimate: number;
};

type LoaderData = {
  shopName: string;
  stats: {
    openPOs: number;
    suppliers: number;
    products: number;
    atRiskCount: number;
    arrivingCount: number;
  };
  atRiskProducts: AtRiskProduct[];
  unconfirmedPOs: UnconfirmedPO[];
  overdueDeliveries: OverdueDelivery[];
  draftPOs: DraftPO[];
  arrivingSoon: ArrivingPO[];
  stockLevels: StockLevel[];
};

type ActionCard = {
  key: string;
  urgency: number;
  iconType: string;
  iconTone: "critical" | "warning" | "info";
  title: string;
  body: string;
  imageUrl?: string | null;
  actionLabel: string;
  onAction: () => void;
};

export default function DashboardPage() {
  const {
    stats,
    atRiskProducts,
    unconfirmedPOs,
    overdueDeliveries,
    draftPOs,
    arrivingSoon,
    stockLevels,
  } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const actionCards: ActionCard[] = [
    ...overdueDeliveries.map((po) => ({
      key: `overdue-${po.id}`,
      urgency: 0,
      iconType: "alert-triangle",
      iconTone: "critical" as const,
      title: `${po.poNumber} delivery overdue`,
      body: `Expected ${new Date(po.expectedDelivery).toLocaleDateString()} from ${po.supplierName ?? "supplier"}.`,
      actionLabel: "Contact supplier",
      onAction: () => navigate(`/app/purchase-orders/${po.id}`),
    })),
    ...atRiskProducts.map((p) => ({
      key: `risk-${p.ruleId}`,
      urgency: 1,
      iconType: "inventory",
      iconTone: "critical" as const,
      title: `${p.title} at risk`,
      body: `Current stock: ${p.currentStock} / Reorder point: ${p.reorderPoint}.`,
      imageUrl: p.imageUrl,
      actionLabel: "Reorder now",
      onAction: () => navigate(`/app/products/${p.productId}`),
    })),
    ...unconfirmedPOs.map((po) => ({
      key: `unconf-${po.id}`,
      urgency: 2,
      iconType: "email",
      iconTone: "warning" as const,
      title: `No reply on ${po.poNumber}`,
      body: `Sent ${po.daysSinceSent} day${po.daysSinceSent !== 1 ? "s" : ""} ago to ${po.supplierName ?? "supplier"}.`,
      actionLabel: "Follow up",
      onAction: () => navigate(`/app/purchase-orders/${po.id}`),
    })),
    ...draftPOs.map((po) => ({
      key: `draft-${po.id}`,
      urgency: 3,
      iconType: "order",
      iconTone: "info" as const,
      title: `Draft ${po.poNumber} waiting to send`,
      body: `For ${po.supplierName ?? "supplier"}.`,
      actionLabel: "Review draft",
      onAction: () => navigate(`/app/purchase-orders/${po.id}`),
    })),
  ].sort((a, b) => a.urgency - b.urgency);

  const [previewEmpty, setPreviewEmpty] = useState(false);
  const isCaughtUp = previewEmpty || actionCards.length === 0;

  return (
    <TitleBar heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/purchase-orders")}
      >
        View purchase orders
      </s-button>

      {/* Sidebar: Days of Stock */}
      <s-section heading="Days of Stock Remaining" slot="aside">
        {stockLevels.length === 0 ? (
          <s-paragraph color="subdued">
            No tracked products yet.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {stockLevels.map((item) => {
              const capped = Math.min(item.daysEstimate, 60);
              const pct = Math.round((capped / 60) * 100);
              const color =
                item.daysEstimate <= 7
                  ? "#E51C00"
                  : item.daysEstimate <= 14
                  ? "#E8A600"
                  : "#1A7A4C";
              const isLeadTime = item.reorderPoint > 0 && item.daysEstimate <= 14;
              return (
                <div key={item.productId}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <s-text>{item.title}</s-text>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {isLeadTime && (
                        <s-icon type="alert-triangle" tone="warning" size="small" />
                      )}
                      <s-text color="subdued">
                        {item.daysEstimate >= 999 ? "—" : `${item.daysEstimate}d`}
                      </s-text>
                    </div>
                  </div>
                  <div style={{ background: "#F1F2F3", borderRadius: 4, height: 8, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 4,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <s-button onClick={() => navigate("/app/forecasts")}>
              View all
            </s-button>
          </s-stack>
        )}
      </s-section>

      {/* Sidebar: Recent Activity (visual placeholder) */}
      <s-section heading="Recent Activity" slot="aside">
        <s-paragraph color="subdued">
          Recent purchase order, stock, and rule activity will appear here.
        </s-paragraph>
      </s-section>

      {/* Top stat tiles */}
      <div style={{ marginBottom: 28  }}>
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          <StatTile
            icon="inventory"
            label="Products"
            value={stats.products}
            onClick={() => navigate("/app/products")}
          />
          <StatTile
            icon="order"
            label="Active POs"
            value={stats.openPOs}
            onClick={() => navigate("/app/purchase-orders")}
          />
          <StatTile
            icon="delivery"
            label="Arriving"
            value={stats.arrivingCount}
            onClick={() => navigate("/app/purchase-orders")}
          />
        </s-grid>
      </div>

      {/* Action Feed */}
      <s-section heading={previewEmpty ? undefined : "Action Feed"}>
        <s-stack direction="inline" gap="small-300">
          <s-button
            variant={previewEmpty ? "secondary" : "primary"}
            onClick={() => setPreviewEmpty(false)}
          >
            Live
          </s-button>
          <s-button
            variant={previewEmpty ? "primary" : "secondary"}
            onClick={() => setPreviewEmpty(true)}
          >
            Preview empty
          </s-button>
        </s-stack>
        {isCaughtUp ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", padding: "24px 16px" }}>
            <img
              src={cloudSvg}
              alt=""
              style={{ width: 260, height: "auto" }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                lineHeight: "32px",
                color: "var(--s-color-text, #202223)",
                textAlign: "center",
              }}
            >
              You're all caught up
            </h2>
            <p style={{ margin: 0, maxWidth: 360, color: "var(--s-color-text-subdued, #6D7175)", fontSize: 14, lineHeight: "20px", textAlign: "center" }}>
              Brim is monitoring your inventory in the background. We'll alert you when action is needed.
            </p>
            <s-button
              variant="primary"
              onClick={() => navigate("/app/products")}
            >
              View automated rules
            </s-button>
          </div>
        ) : (
          <s-stack direction="block" gap="base">
            {actionCards.map((card) => (
              <s-box
                key={card.key}
                border="base"
                borderRadius="base"
                padding="base"
              >
                <s-grid
                  gridTemplateColumns="auto 1fr auto"
                  gap="base"
                  alignItems="center"
                >
                  {card.imageUrl ? (
                    <s-thumbnail
                      src={card.imageUrl}
                      alt={card.title}
                      size="small"
                    />
                  ) : (
                    <s-icon type={card.iconType as "alert-triangle" | "inventory" | "email" | "order"} tone={card.iconTone} />
                  )}
                  <s-stack direction="block" gap="none">
                    <s-heading>{card.title}</s-heading>
                    <s-text color="subdued">{card.body}</s-text>
                  </s-stack>
                  <s-button onClick={card.onAction}>
                    {card.actionLabel}
                  </s-button>
                </s-grid>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      {/* Arriving Soon */}
      {arrivingSoon.length > 0 && (
        <s-section heading="Arriving Soon">
          <s-table>
            <s-table-header-row>
              <s-table-header>PO Number</s-table-header>
              <s-table-header>Supplier</s-table-header>
              <s-table-header>Expected delivery</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {arrivingSoon.map((po) => (
                <s-table-row key={po.id}>
                  <s-table-cell>
                    <s-link href={`/app/purchase-orders/${po.id}`}>
                      {po.poNumber}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{po.supplierName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {new Date(po.expectedDelivery).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      variant="primary"
                      onClick={() =>
                        navigate(`/app/purchase-orders/${po.id}`)
                      }
                    >
                      Receive
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {/* Running Low */}
      {atRiskProducts.length > 0 && (
        <s-section heading="Running Low">
          <s-table>
            <s-table-header-row>
              <s-table-header></s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Stock</s-table-header>
              <s-table-header>Reorder point</s-table-header>
              <s-table-header>Days remaining</s-table-header>
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
                  <s-table-cell>—</s-table-cell>
                  <s-table-cell>{p.supplierName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-button
                      onClick={() => navigate(`/app/products/${p.productId}`)}
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

    </TitleBar>
  );
}

function StatTile({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        cursor: "pointer",
        height: "100%",
        display: "flex",
        background: "white",
        border: "1px solid var(--s-color-border, #E1E3E5)",
        borderRadius: "8px",
        padding: "5px 7px",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <div
        style={{
          background: "var(--s-color-bg-subdued, #F1F2F3)",
          borderRadius: "6px",
          padding: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <s-icon type={icon as "inventory" | "order" | "delivery"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <s-text type="strong">
          {label}: {String(value)}
        </s-text>
      </div>
      <s-icon type="chevron-right" />
    </div>
  );
}
