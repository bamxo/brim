import { upsertProducts, deactivateDeletedProducts } from "./controller.server";

// 50 products per page keeps each request well under Shopify's 1000 query-cost limit.
const PRODUCTS_QUERY = `#graphql
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        featuredMedia {
          ... on MediaImage {
            image {
              url
            }
          }
        }
        variants(first: 10) {
          nodes {
            id
            title
            sku
            inventoryItem {
              id
              inventoryLevels(first: 3) {
                nodes {
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
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
      nodes: Array<{ quantities: Array<{ name: string; quantity: number }> }>;
    };
  };
};

type ShopifyProduct = {
  id: string;
  title: string;
  featuredMedia?: { image?: { url: string } } | null;
  variants: { nodes: ShopifyVariant[] };
};

type ProductsQueryData = {
  products?: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyProduct[];
  };
};

function gidToId(gid: string): string {
  return gid.split("/").pop() ?? gid;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncProductsForShop(admin: any, shopId: string) {
  const rows: Record<string, unknown>[] = [];
  const seenProductIds = new Set<string>();
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (admin.graphql as any)(PRODUCTS_QUERY, { variables: { cursor } });
    const { data } = (await response.json()) as { data?: ProductsQueryData };
    const productsPage = data?.products;

    if (!productsPage) break;

    for (const product of productsPage.nodes) {
      const shopifyProductId = gidToId(product.id);
      seenProductIds.add(shopifyProductId);
      for (const variant of product.variants.nodes) {
        const shopifyVariantId = gidToId(variant.id);
        const shopifyInventoryItemId = gidToId(variant.inventoryItem.id);
        const stock = variant.inventoryItem.inventoryLevels.nodes.reduce(
          (sum, lvl) => {
            const avail = lvl.quantities.find((q) => q.name === "available");
            return sum + (avail?.quantity ?? 0);
          },
          0,
        );
        rows.push({
          shop_id: shopId,
          shopify_product_id: shopifyProductId,
          shopify_variant_id: shopifyVariantId,
          shopify_inventory_item_id: shopifyInventoryItemId,
          title: product.title,
          variant_title: variant.title === "Default Title" ? null : variant.title,
          sku: variant.sku || null,
          current_stock: stock,
          image_url: product.featuredMedia?.image?.url ?? null,
          is_active: true,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    hasNextPage = productsPage.pageInfo.hasNextPage;
    cursor = productsPage.pageInfo.endCursor;
  }

  if (rows.length === 0) return { synced: 0, error: "No products found in this store." };

  const { error } = await upsertProducts(shopId, rows);
  if (error) return { synced: 0, error };

  // Soft-delete any products that are in the DB but no longer exist in Shopify
  const { error: deleteError } = await deactivateDeletedProducts(shopId, [...seenProductIds]);
  if (deleteError) console.error("Failed to deactivate deleted products:", deleteError);

  return { synced: rows.length, error: null };
}
