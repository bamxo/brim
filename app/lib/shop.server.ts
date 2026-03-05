import type { Session } from "@shopify/shopify-api";
import supabase from "../supabase.server";

export type Shop = {
  id: string;
  shopify_domain: string;
  shopify_access_token: string;
  email: string | null;
  shop_name: string | null;
  currency: string;
  timezone: string | null;
  is_active: boolean;
  installed_at: string | null;
  uninstalled_at: string | null;
  created_at: string;
};

/**
 * Upserts the shop row on every authenticated request.
 * Returns the Supabase shop UUID used to scope all business queries.
 */
export async function upsertShop(session: Session): Promise<Shop> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("shops")
    .upsert(
      {
        shopify_domain: session.shop,
        shopify_access_token: session.accessToken ?? "",
        is_active: true,
        installed_at: new Date().toISOString(),
        uninstalled_at: null,
      },
      {
        onConflict: "shopify_domain",
        // Only update the token and active status on re-install;
        // preserve existing shop_name, email, currency, timezone.
        ignoreDuplicates: false,
      },
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert shop: ${error.message}`);
  return data as Shop;
}

/**
 * Looks up the shop UUID by Shopify domain.
 * Use this in loaders/actions where you already have the session.
 */
export async function getShopByDomain(shopDomain: string): Promise<Shop> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("shops")
    .select("*")
    .eq("shopify_domain", shopDomain)
    .single();

  if (error) throw new Error(`Shop not found for domain ${shopDomain}: ${error.message}`);
  return data as Shop;
}

/**
 * Marks the shop as inactive on uninstall.
 * The access token is cleared so background jobs skip this shop.
 */
export async function deactivateShop(shopDomain: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shops")
    .update({
      is_active: false,
      shopify_access_token: "",
      uninstalled_at: new Date().toISOString(),
    })
    .eq("shopify_domain", shopDomain);

  if (error) throw new Error(`Failed to deactivate shop ${shopDomain}: ${error.message}`);
}
