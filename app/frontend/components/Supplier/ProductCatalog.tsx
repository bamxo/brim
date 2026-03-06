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
};

type Props = {
  allProducts: Product[];
  assignedProducts: AssignedProduct[];
  lastSyncedAt: string | null;
  productError?: string;
  onAddProduct: (productId: string) => void;
  onRemoveProduct: (productId: string) => void;
};

// ── Product row ──────────────────────────────────────────────────────────────
function ProductRow({
  product,
  actionLabel,
  actionVariant,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: {
  product: Product;
  actionLabel: string;
  actionVariant?: "primary" | "secondary" | "tertiary";
  onAction: (id: string) => void;
  secondaryLabel?: string;
  onSecondaryAction?: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "1px solid #f1f2f3",
        gap: "10px",
      }}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{ width: 36, height: 36, borderRadius: 4, background: "#f1f2f3", flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            lineHeight: "18px",
            color: "#202223",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {product.title}
        </div>
        {(product.variant_title || product.sku) && (
          <div style={{ fontSize: 12, color: "#6d7175", lineHeight: "16px" }}>
            {[product.variant_title, product.sku ? `SKU: ${product.sku}` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <s-button
          variant={actionVariant ?? "primary"}
          onClick={() => onAction(product.id)}
        >
          {actionLabel}
        </s-button>
        {secondaryLabel && onSecondaryAction && (
          <s-button tone="critical" onClick={() => onSecondaryAction(product.id)}>
            {secondaryLabel}
          </s-button>
        )}
      </div>
    </div>
  );
}

// ── Searchable scrollable list ───────────────────────────────────────────────
function SearchableProductList({
  products,
  placeholder,
  emptyMessage,
  actionLabel,
  actionVariant,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: {
  products: Product[];
  placeholder: string;
  emptyMessage: string;
  actionLabel: string;
  actionVariant?: "primary" | "secondary" | "tertiary";
  onAction: (id: string) => void;
  secondaryLabel?: string;
  onSecondaryAction?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.variant_title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      style={{ border: "1px solid #e1e3e5", borderRadius: "8px", overflow: "hidden", marginTop: "10px" }}
    >
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #e1e3e5", background: "#fafbfb" }}>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            border: "1px solid #c9cccf",
            borderRadius: "6px",
            fontSize: "12px",
            fontFamily: "inherit",
            outline: "none",
            background: "#fff",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "16px 14px", fontSize: 13, color: "#6d7175" }}>
            {search ? "No products match your search." : emptyMessage}
          </div>
        ) : (
          filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              actionLabel={actionLabel}
              actionVariant={actionVariant}
              onAction={onAction}
              secondaryLabel={secondaryLabel}
              onSecondaryAction={onSecondaryAction}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Product catalog section ──────────────────────────────────────────────────
export default function ProductCatalog({
  allProducts,
  assignedProducts,
  lastSyncedAt,
  productError,
  onAddProduct,
  onRemoveProduct,
}: Props) {
  const navigate = useNavigate();
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string } | null>(null);

  const assignedIds = new Set(assignedProducts.map((p) => p.id));
  const availableProducts = allProducts.filter((p) => !assignedIds.has(p.id));

  const handleRemoveClick = (productId: string) => {
    const product = assignedProducts.find((p) => p.id === productId);
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
    <s-section>
      {/* Custom header row — s-section heading prop puts the title on its own line
          with no way to add content beside it, so we render the row manually */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#202223" }}>
          Product catalog
        </span>
        <SyncProductsButton lastSyncedAt={lastSyncedAt} />
      </div>

      {productError && (
        <s-banner tone="critical" heading="Could not update product assignment">
          <s-paragraph>{productError}</s-paragraph>
        </s-banner>
      )}

      <s-text>
        <strong>All products ({availableProducts.length} available to add)</strong>
      </s-text>
      {allProducts.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6d7175", marginTop: 8 }}>
          No products synced yet. Click "Sync products" to import from your store.
        </div>
      ) : (
        <SearchableProductList
          products={availableProducts}
          placeholder="Search products to add…"
          emptyMessage="All synced products are already assigned to this supplier."
          actionLabel="Add"
          actionVariant="primary"
          onAction={onAddProduct}
        />
      )}

      <div style={{ marginTop: "20px" }}>
        <s-text>
          <strong>Assigned to this supplier ({assignedProducts.length})</strong>
        </s-text>
        <SearchableProductList
          products={assignedProducts}
          placeholder="Search assigned products…"
          emptyMessage="No products assigned yet. Add products from the list above."
          actionLabel="Edit"
          actionVariant="tertiary"
          onAction={(id) => navigate(`/app/products/${id}`)}
          secondaryLabel="Remove"
          onSecondaryAction={handleRemoveClick}
        />
      </div>

      <RemoveProductModal
        modalId="remove-product-modal"
        productName={pendingRemove?.title ?? ""}
        onConfirm={confirmRemove}
      />
    </s-section>
  );
}
