import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { useActionData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

const PRODUCTS_QUERY = `#graphql
  query GetProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        variants(first: 100) {
          nodes {
            id
            title
            sku
            inventoryItem {
              id
              inventoryLevels(first: 5) {
                nodes {
                  available
                }
              }
            }
          }
        }
      }
    }
  }
`;

type ShopifyVariant = {
  id: string;
  title: string;
  sku: string | null;
  inventoryItem: {
    id: string;
    inventoryLevels: {
      nodes: Array<{ available: number }>;
    };
  };
};

type ShopifyProduct = {
  id: string;
  title: string;
  variants: { nodes: ShopifyVariant[] };
};

function gidToId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  type ProductsQueryData = {
    products?: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ShopifyProduct[];
    };
  };

  while (hasNextPage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (admin.graphql as any)(PRODUCTS_QUERY, {
      variables: { cursor },
    });
    const { data } = (await response.json()) as { data?: ProductsQueryData };
    const productsPage = data?.products;

    if (!productsPage) break;

    for (const product of productsPage.nodes as ShopifyProduct[]) {
      const shopifyProductId = gidToId(product.id);

      for (const variant of product.variants.nodes) {
        const shopifyVariantId = gidToId(variant.id);
        const shopifyInventoryItemId = gidToId(variant.inventoryItem.id);
        const stock =
          variant.inventoryItem.inventoryLevels.nodes.reduce(
            (sum: number, lvl: { available: number }) => sum + (lvl.available ?? 0),
            0,
          );

        rows.push({
          shop_id: shop.id,
          shopify_product_id: shopifyProductId,
          shopify_variant_id: shopifyVariantId,
          shopify_inventory_item_id: shopifyInventoryItemId,
          title: product.title,
          variant_title: variant.title === "Default Title" ? null : variant.title,
          sku: variant.sku || null,
          current_stock: stock,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    hasNextPage = productsPage.pageInfo.hasNextPage;
    cursor = productsPage.pageInfo.endCursor;
  }

  if (rows.length === 0) {
    return { synced: 0, error: "No products found in this store." };
  }

  // Upsert in batches of 100 to stay within Supabase payload limits
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("products")
      .upsert(rows.slice(i, i + BATCH), {
        onConflict: "shop_id,shopify_variant_id",
      });

    if (error) return { synced: 0, error: error.message };
  }

  return redirect(`/app/products?synced=${rows.length}`);
};

export default function ProductsSync() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSyncing = navigation.state === "submitting";

  return (
    <s-page heading="Sync products from Shopify">
      {actionData?.error && (
        <s-banner tone="critical" heading="Sync failed">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-paragraph>
          This will import all products and variants from your Shopify store
          into Brim. Existing products will be updated with current stock
          levels. This may take a moment for large catalogues.
        </s-paragraph>
        <form method="post">
          <s-button
            variant="primary"
            type="submit"
            {...(isSyncing ? { loading: true } : {})}
          >
            {isSyncing ? "Syncing…" : "Start sync"}
          </s-button>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
