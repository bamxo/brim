import { useLoaderData, useNavigate } from "react-router";

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
  reorder_rules: ReorderRule[];
};

type LoaderData = { products: Product[] };

export default function ProductsPage() {
  const { products } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  return (
    <s-page heading="Products">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/products/sync")}
      >
        Sync from Shopify
      </s-button>

      {products.length === 0 ? (
        <s-section heading="No products synced yet">
          <s-paragraph>
            Sync your Shopify products to configure reorder rules and automate
            purchase orders.
          </s-paragraph>
          <s-button
            variant="primary"
            onClick={() => navigate("/app/products/sync")}
          >
            Sync from Shopify
          </s-button>
        </s-section>
      ) : (
        <s-section>
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>SKU</s-table-header>
              <s-table-header>Stock</s-table-header>
              <s-table-header>Reorder point</s-table-header>
              <s-table-header>Supplier</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.map((product) => {
                const rule = product.reorder_rules?.[0];
                const isLow = rule && product.current_stock <= rule.reorder_point;
                return (
                  <s-table-row
                    key={product.id}
                    clickDelegate={`product-link-${product.id}`}
                  >
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
        </s-section>
      )}
    </s-page>
  );
}
