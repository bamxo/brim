import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products, error } = await (supabase as any)
    .from("products")
    .select(
      `
      id, title, variant_title, sku, current_stock,
      reorder_rules (
        id, reorder_point, reorder_quantity, is_active,
        primary_supplier:suppliers!primary_supplier_id (name)
      )
    `,
    )
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .order("title");

  if (error) throw new Error(error.message);

  return { products: products ?? [] };
};

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

export default function Products() {
  const { products } = useLoaderData<typeof loader>();
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
              {products.map((product: Product) => {
                const rule = product.reorder_rules?.[0];
                const isLow = rule && product.current_stock <= rule.reorder_point;
                return (
                  <s-table-row
                    key={product.id}
                    clickDelegate={`product-link-${product.id}`}
                  >
                    <s-table-cell>
                      <s-link id={`product-link-${product.id}`} href={`/app/products/${product.id}`}>
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
