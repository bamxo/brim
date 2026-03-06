import { useState, useEffect } from "react";
import { useActionData, useFetcher, useLoaderData, useNavigate, useSubmit } from "react-router";
import RemoveProductModal from "../components/Supplier/RemoveProductModal";
import DeleteModal from "../components/Supplier/DeleteSupplierModal";

type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  current_stock: number;
  image_url: string | null;
};

type AssignedProduct = Product & {
  reorder_point: number;
  reorder_quantity: number;
};

type LoaderData = {
  supplier: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  };
  assignedProducts: AssignedProduct[];
  allProducts: Product[];
  lastSyncedAt: string | null;
};

type ActionData = {
  errors?: Record<string, string | undefined>;
  success?: boolean;
  syncResult?: { synced: number; error: string | null };
  productOk?: boolean;
  productError?: string;
};

function formatSyncDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Scrollable product list sub-component ──────────────────────────────────
function ProductRow({
  product,
  action,
  actionLabel,
  actionVariant,
  onAction,
  secondaryAction,
  secondaryLabel,
  onSecondaryAction,
}: {
  product: Product;
  action: string;
  actionLabel: string;
  actionVariant?: string;
  onAction: (id: string) => void;
  secondaryAction?: string;
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
          style={{
            width: 36,
            height: 36,
            borderRadius: 4,
            background: "#f1f2f3",
            flexShrink: 0,
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: "18px", color: "#202223", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      {/* Primary action (Edit) on the left, secondary action (Remove) on the right */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <s-button
          variant={(actionVariant ?? "primary") as "primary" | "secondary" | "tertiary"}
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
  actionVariant?: string;
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
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        overflow: "hidden",
        marginTop: "10px",
      }}
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
              action={actionLabel}
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function SupplierDetailPage() {
  const { supplier, assignedProducts, allProducts, lastSyncedAt } =
    useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const syncFetcher = useFetcher<ActionData>();
  const productFetcher = useFetcher<ActionData>();
  const [pendingRemove, setPendingRemove] = useState<{ id: string; title: string } | null>(null);

  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  // ── Timed success banner for save ──────────────────────────────────────
  const [savedOk, setSavedOk] = useState(false);
  useEffect(() => {
    if (actionData?.success) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 4000);
      return () => clearTimeout(t);
    }
  }, [actionData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync state ─────────────────────────────────────────────────────────
  const isSyncing = syncFetcher.state !== "idle";
  const [displayedSyncedAt, setDisplayedSyncedAt] = useState(lastSyncedAt);
  useEffect(() => {
    if (syncFetcher.data?.syncResult && !syncFetcher.data.syncResult.error) {
      setDisplayedSyncedAt(new Date().toISOString());
    }
  }, [syncFetcher.data]);
  // Keep in sync with loader updates (e.g. after page navigation)
  useEffect(() => {
    setDisplayedSyncedAt(lastSyncedAt);
  }, [lastSyncedAt]);

  // ── Compute available vs assigned ──────────────────────────────────────
  const assignedIds = new Set(assignedProducts.map((p) => p.id));
  const availableProducts = allProducts.filter((p) => !assignedIds.has(p.id));

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSave = () => {
    const form = document.getElementById("supplier-form") as HTMLFormElement;
    if (!form) return;
    const get = (name: string) =>
      (form.querySelector(`[name="${name}"]`) as HTMLElement & { value: string })?.value ?? "";
    const fd = new FormData();
    fd.append("name", get("name"));
    fd.append("email", get("email"));
    fd.append("phone", get("phone"));
    fd.append("notes", get("notes"));
    submit(fd, { method: "post" });
  };

  const handleDelete = () => {
    const modal = document.getElementById("delete-supplier-modal") as HTMLElement & { showOverlay: () => void };
    modal?.showOverlay();
  };

  const confirmDelete = () => {
    const fd = new FormData();
    fd.append("intent", "delete");
    submit(fd, { method: "post" });
  };

  const handleSync = () => {
    const fd = new FormData();
    fd.append("intent", "sync-products");
    syncFetcher.submit(fd, { method: "post" });
  };

  const handleAddProduct = (productId: string) => {
    const fd = new FormData();
    fd.append("intent", "add-product");
    fd.append("product_id", productId);
    productFetcher.submit(fd, { method: "post" });
  };

  const handleRemoveProduct = (productId: string) => {
    const product = assignedProducts.find((p) => p.id === productId);
    if (!product) return;
    setPendingRemove({ id: product.id, title: product.title });
    const modal = document.getElementById("remove-product-modal") as HTMLElement & { showOverlay: () => void };
    modal?.showOverlay();
  };

  const confirmRemoveProduct = () => {
    if (!pendingRemove) return;
    const fd = new FormData();
    fd.append("intent", "remove-product");
    fd.append("product_id", pendingRemove.id);
    productFetcher.submit(fd, { method: "post" });
    setPendingRemove(null);
  };

  return (
    <>
      {/* Spinning keyframes — injected once into the document */}
      <style>{`
        @keyframes brim-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .brim-spin { animation: brim-spin 0.8s linear infinite; display: inline-block; }
      `}</style>

      <s-page heading={supplier.name}>
        {"form" in errors && (
          <s-banner tone="critical" heading="Could not save supplier">
            <s-paragraph>{errors.form}</s-paragraph>
          </s-banner>
        )}

        {/* ── Supplier information ─────────────────────────────────── */}
        <s-section heading="Supplier information">
          <form id="supplier-form" method="post">
            <s-stack direction="block" gap="base">
              <s-text-field
                name="name"
                label="Supplier name"
                required
                value={supplier.name}
                error={"name" in errors ? errors.name : undefined}
              />
              <s-email-field
                name="email"
                label="Email address"
                required
                value={supplier.email}
                help-text="Purchase orders will be sent to this address"
                error={"email" in errors ? errors.email : undefined}
              />
              <s-text-field
                name="phone"
                label="Phone number"
                value={supplier.phone ?? ""}
                help-text="Optional — for WhatsApp or clipboard sharing"
              />
              <s-text-area
                name="notes"
                label="Notes"
                value={supplier.notes ?? ""}
                help-text="Internal notes about this supplier"
              />
            </s-stack>
          </form>

          {/* Inline feedback row: green text left, buttons right */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "16px",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: savedOk ? "#007a5a" : "transparent",
                fontWeight: 500,
                transition: "color 0.2s",
              }}
            >
              ✓ Changes saved
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <s-button onClick={() => navigate("/app/suppliers")}>Cancel</s-button>
              <s-button variant="primary" onClick={handleSave}>
                Save changes
              </s-button>
            </div>
          </div>
        </s-section>

        {/* ── Product catalog ─────────────────────────────────────── */}
        <s-section heading="Product catalog">
          {/* Header row: last-synced subtext + sync button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div style={{ flex: 1 }}>
              {displayedSyncedAt ? (
                <span style={{ fontSize: 12, color: "#6d7175" }}>
                  Last synced {formatSyncDate(displayedSyncedAt)}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: "#6d7175" }}>
                  Not yet synced
                </span>
              )}
            </div>
            <s-button variant="primary" onClick={handleSync} disabled={isSyncing}>
              <span className={isSyncing ? "brim-spin" : ""} style={{ marginRight: 6 }}>
                ↻
              </span>
              {isSyncing ? "Syncing…" : "Sync products"}
            </s-button>
          </div>

          {syncFetcher.data?.syncResult?.error && (
            <s-banner tone="critical" heading="Sync failed">
              <s-paragraph>{syncFetcher.data.syncResult.error}</s-paragraph>
            </s-banner>
          )}
          {productFetcher.data?.productError && (
            <s-banner tone="critical" heading="Could not update product assignment">
              <s-paragraph>{productFetcher.data.productError}</s-paragraph>
            </s-banner>
          )}

          {/* All synced products */}
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
              onAction={handleAddProduct}
            />
          )}

          {/* Products assigned to this supplier */}
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
              onSecondaryAction={handleRemoveProduct}
            />
          </div>
        </s-section>

        {/* ── Delete supplier modal ───────────────────────────────── */}
        <DeleteModal
          modalId="delete-supplier-modal"
          supplierName={supplier.name}
          onConfirm={confirmDelete}
        />

        {/* ── Remove product modal ────────────────────────────────── */}
        <RemoveProductModal
          modalId="remove-product-modal"
          productName={pendingRemove?.title ?? ""}
          onConfirm={confirmRemoveProduct}
        />

        {/* ── Danger zone ─────────────────────────────────────────── */}
        <s-section heading="Danger zone" slot="aside">
          <s-paragraph>
            Permanently deletes this supplier and removes them from all active
            reorder rules. Historical purchase orders are kept but will no longer
            reference this supplier. This action cannot be undone.
          </s-paragraph>
          <s-button tone="critical" onClick={handleDelete}>
            Delete supplier
          </s-button>
        </s-section>
      </s-page>
    </>
  );
}
