import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../../backend/shops/controller.server";
import { buildAuthUrl } from "../../backend/google/oauth.server";
import supabase from "../../db/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop_id");

  if (shopId) {
    // Called from new tab — no Shopify session available, use shop_id directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shop } = await (supabase as any)
      .from("shops")
      .select("id")
      .eq("id", shopId)
      .single();
    if (!shop) return new Response("Invalid shop", { status: 400 });
    const authUrl = buildAuthUrl(shopId);
    return redirect(authUrl);
  }

  // Called from within Shopify iframe — use session as normal
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const authUrl = buildAuthUrl(shop.id);
  return redirect(authUrl);
};
