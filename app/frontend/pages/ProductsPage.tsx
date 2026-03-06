import { useState } from "react";
import { useLoaderData } from "react-router";
import SyncProductsButton from "../components/Supplier/SyncProductsButton";

type ReorderRule = {
  id: string;
  reorder_point: number;
  reorder_quantity: number;
  is_active: boolean;
  primary_supplier: { name: string } | null;
};

type Product = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  current_stock: number;
  image_url: string | null;
  reorder_rules: ReorderRule[];
};

type LoaderData = { products: Product[]; lastSyncedAt: string | null };

export default function ProductsPage() {
  const { products, lastSyncedAt } = useLoaderData<LoaderData>();
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.variant_title ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <s-page heading="Products">
      {products.length === 0 ? (
        <s-section heading="No products synced yet">
          <s-banner
            tone="info"
            heading="Import your Shopify inventory to get started"
          >
            <s-paragraph>
              Syncing pulls your products and current stock levels from Shopify.
              Once synced, you can configure reorder points and assign suppliers
              to automate purchase orders.
            </s-paragraph>
          </s-banner>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
            <SyncProductsButton lastSyncedAt={lastSyncedAt} />
          </div>
        </s-section>
      ) : (
        <s-section>
          {/* Header row: title + sync (same pattern as ProductCatalog) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "#202223" }}>
              Products
            </span>
            <SyncProductsButton lastSyncedAt={lastSyncedAt} />
          </div>

          {/* Search (copy ProductCatalog implementation) */}
          <div
            style={{
              border: "1px solid #e1e3e5",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid #e1e3e5",
                background: "#fafbfb",
              }}
            >
              <input
                type="text"
                placeholder="Search products…"
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
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 13, color: "#6d7175" }}>
              No products match your search.
            </div>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header></s-table-header>
                <s-table-header>Product</s-table-header>
                <s-table-header>SKU</s-table-header>
                <s-table-header>Stock</s-table-header>
                <s-table-header>Reorder point</s-table-header>
                <s-table-header>Supplier</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {filteredProducts.map((product) => {
                  const rule = product.reorder_rules?.[0];
                  const isLow = rule && product.current_stock <= rule.reorder_point;
                  return (
                    <s-table-row
                      key={product.id}
                      clickDelegate={`product-link-${product.id}`}
                    >
                      <s-table-cell>
                        <s-thumbnail
                          src={product.image_url ?? undefined}
                          alt={product.title}
                          size="small"
                        />
                      </s-table-cell>
                      <s-table-cell>
                        <s-link
                          id={`product-link-${product.id}`}
                          href={`/app/products/${product.id}`}
                        >
                          {product.title}
                          {product.variant_title ? ` — ${product.variant_title}` : ""}
                        </s-link>
                      </s-table-cell>
                      <s-table-cell>{product.sku ?? "—"}</s-table-cell>
                      <s-table-cell>
                        <s-badge tone={isLow ? "warning" : "neutral"}>
                          {String(product.current_stock)}
                        </s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        {rule ? String(rule.reorder_point) : "—"}
                      </s-table-cell>
                      <s-table-cell>
                        {rule?.primary_supplier?.name ?? "—"}
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      )}
    </s-page>
  );
}
