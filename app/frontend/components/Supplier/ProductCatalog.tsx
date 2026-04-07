import { useState } from "react";
import { useNavigate } from "react-router";
import SyncProductsButton from "./SyncProductsButton";
import RemoveProductModal from "./RemoveProductModal";

export type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  current_stock: number;
  image_url: string | null;
};

export type AssignedProduct = Product & {
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number | null;
};

export type CustomItem = {
  id: string;
  name: string;
  sku: string | null;
  unit_cost: number | null;
};

type Props = {
  allProducts: Product[];
  assignedProducts: AssignedProduct[];
  customItems: CustomItem[];
  lastSyncedAt: string | null;
  productError?: string;
  customItemError?: string;
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (productId: string) => void;
  onAddCustomItem: () => void;
  onEditCustomItem: (item: CustomItem) => void;
  onRemoveCustomItem: (itemId: string) => void;
};

type Tab = "store" | "custom";

const PAGE_SIZE = 5;

function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return "--";
  return `$${Number(cost).toFixed(2)}`;
}

// ── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "store", label: "Store products" },
    { key: "custom", label: "Custom items" },
  ];

  return (
    <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #e1e3e5" }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
            background: "none",
            border: "none",
            borderBottom: active === tab.key ? "2px solid #2c6ecb" : "2px solid transparent",
            color: active === tab.key ? "#2c6ecb" : "#6d7175",
            transition: "color 0.15s, border-color 0.15s",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "10px 0", gap: "4px" }}>
      <s-button
        variant="tertiary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        &lt;
      </s-button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <s-button
          key={p}
          variant={p === page ? "primary" : "tertiary"}
          onClick={() => onPageChange(p)}
        >
          {String(p)}
        </s-button>
      ))}
      <s-button
        variant="tertiary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        &gt;
      </s-button>
    </div>
  );
}

// ── Store products tab ──────────────────────────────────────────────────────
function StoreProductsTab({
  allProducts,
  assignedProducts,
  productError,
  onAddProduct,
  onRemoveProduct,
}: {
  allProducts: Product[];
  assignedProducts: AssignedProduct[];
  productError?: string;
  onAddProduct: (product: Product) => void;
  onRemoveProduct: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string } | null>(null);

  const assignedMap = new Map(assignedProducts.map((p) => [p.id, p]));

  const merged = allProducts.map((p) => {
    const assigned = assignedMap.get(p.id);
    return {
      ...p,
      isAssigned: !!assigned,
      unit_cost: assigned?.unit_cost ?? null,
    };
  });

  const filtered = merged.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleRemoveClick = (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;
    setPendingRemove({ id: product.id, title: product.title });
    const modal = document.getElementById("remove-product-modal") as HTMLElement & {
      showOverlay: () => void;
    };
    modal?.showOverlay();
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    onRemoveProduct(pendingRemove.id);
    setPendingRemove(null);
  };

  return (
    <>
      {productError && (
        <s-banner tone="critical" heading="Could not update product assignment">
          <s-paragraph>{productError}</s-paragraph>
        </s-banner>
      )}

      <s-section padding="none">
        <s-table>
          <s-grid slot="filters" gap="small-200" gridTemplateColumns="1fr">
            <s-text-field
              label="Search products"
              labelAccessibilityVisibility="exclusive"
              icon="search"
              placeholder="Search products to add..."
              value={search}
              onInput={(e: Event) => {
                const target = e.target as HTMLInputElement;
                setSearch(target.value);
                setPage(1);
              }}
            />
          </s-grid>

          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
            <s-table-header listSlot="labeled">SKU</s-table-header>
            <s-table-header listSlot="labeled" format="currency">Cost</s-table-header>
            <s-table-header listSlot="inline">Status</s-table-header>
            <s-table-header listSlot="secondary">Actions</s-table-header>
          </s-table-header-row>

          <s-table-body>
            {pageItems.length === 0 ? (
              <s-table-row>
                <s-table-cell>
                  <s-text color="subdued">
                    {search ? "No products match your search." : "No products synced yet."}
                  </s-text>
                </s-table-cell>
                <s-table-cell />
                <s-table-cell />
                <s-table-cell />
                <s-table-cell />
              </s-table-row>
            ) : (
              pageItems.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      {product.image_url ? (
                        <s-clickable
                          href={`/app/products/${product.id}`}
                          accessibilityLabel={`View ${product.title}`}
                          border="base"
                          borderRadius="base"
                          overflow="hidden"
                          inlineSize="40px"
                          blockSize="40px"
                        >
                          <s-image objectFit="cover" src={product.image_url} alt={product.title} />
                        </s-clickable>
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 4, background: "#f1f2f3", flexShrink: 0 }} />
                      )}
                      <s-link href={`/app/products/${product.id}`}>{product.title}</s-link>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{product.sku ?? "--"}</s-table-cell>
                  <s-table-cell>{formatCost(product.unit_cost)}</s-table-cell>
                  <s-table-cell>
                    {product.isAssigned ? (
                      <s-badge tone="success">Assigned</s-badge>
                    ) : (
                      <s-badge>Unassigned</s-badge>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small">
                      {product.isAssigned ? (
                        <>
                          <s-button variant="tertiary" onClick={() => navigate(`/app/products/${product.id}`)}>
                            Edit
                          </s-button>
                          <s-button tone="critical" onClick={() => handleRemoveClick(product.id)}>
                            Remove
                          </s-button>
                        </>
                      ) : (
                        <s-button variant="primary" onClick={() => onAddProduct(product)}>
                          Add
                        </s-button>
                      )}
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))
            )}
          </s-table-body>
        </s-table>
      </s-section>

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />

      <RemoveProductModal
        modalId="remove-product-modal"
        productName={pendingRemove?.title ?? ""}
        onConfirm={confirmRemove}
      />
    </>
  );
}

// ── Custom items tab ────────────────────────────────────────────────────────
function CustomItemsTab({
  customItems,
  customItemError,
  onAddCustomItem,
  onEditCustomItem,
  onRemoveCustomItem,
}: {
  customItems: CustomItem[];
  customItemError?: string;
  onAddCustomItem: () => void;
  onEditCustomItem: (item: CustomItem) => void;
  onRemoveCustomItem: (itemId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = customItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      {customItemError && (
        <s-banner tone="critical" heading="Could not update custom item">
          <s-paragraph>{customItemError}</s-paragraph>
        </s-banner>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <s-button variant="primary" onClick={onAddCustomItem}>
          Add custom item
        </s-button>
      </div>

      <s-section padding="none">
        <s-text-field
          label="Search custom items"
          labelAccessibilityVisibility="exclusive"
          icon="search"
          placeholder="Search custom items..."
          value={search}
          onInput={(e: Event) => {
            const target = e.target as HTMLInputElement;
            setSearch(target.value);
            setPage(1);
          }}
          style={{ marginBottom: 8 }}
        />

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 500, color: "#6d7175" }}>Product</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 500, color: "#6d7175" }}>SKU</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 500, color: "#6d7175" }}>Unit price</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 500, color: "#6d7175" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "14px 12px", color: "#8c9196" }}>
                  {search
                    ? "No items match your search."
                    : "No custom items yet. Add one above."}
                </td>
              </tr>
            ) : (
              pageItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f2f3" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: "10px 12px" }}>{item.sku ?? "--"}</td>
                  <td style={{ padding: "10px 12px" }}>{formatCost(item.unit_cost)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <s-stack direction="inline" gap="small">
                      <s-button variant="tertiary" onClick={() => onEditCustomItem(item)}>
                        Edit
                      </s-button>
                      <s-button tone="critical" onClick={() => onRemoveCustomItem(item.id)}>
                        Remove
                      </s-button>
                    </s-stack>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </s-section>

      <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}

// ── Product catalog section ─────────────────────────────────────────────────
export default function ProductCatalog({
  allProducts,
  assignedProducts,
  customItems,
  lastSyncedAt,
  productError,
  customItemError,
  onAddProduct,
  onRemoveProduct,
  onAddCustomItem,
  onEditCustomItem,
  onRemoveCustomItem,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("store");

  return (
    <s-section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#202223" }}>
          Product catalog
        </span>
        <SyncProductsButton lastSyncedAt={lastSyncedAt} />
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      <div style={{ marginTop: 12 }}>
        {activeTab === "store" ? (
          <StoreProductsTab
            allProducts={allProducts}
            assignedProducts={assignedProducts}
            productError={productError}
            onAddProduct={onAddProduct}
            onRemoveProduct={onRemoveProduct}
          />
        ) : (
          <CustomItemsTab
            customItems={customItems}
            customItemError={customItemError}
            onAddCustomItem={onAddCustomItem}
            onEditCustomItem={onEditCustomItem}
            onRemoveCustomItem={onRemoveCustomItem}
          />
        )}
      </div>
    </s-section>
  );
}
