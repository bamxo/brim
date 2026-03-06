import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import supabase from "../../db/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const shopId = shop.id;

  const now = new Date();

  // Run all queries in parallel
  const [
    openPOResult,
    supplierResult,
    productResult,
    atRiskResult,
    unconfirmedResult,
    overdueResult,
  ] = await Promise.all([
    // Open PO count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .in("status", ["draft", "sent", "confirmed", "in_transit"]),

    // Active supplier count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_active", true),

    // Active product count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_active", true),

    // Products at or below reorder point with active rules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("reorder_rules")
      .select(
        `
        id,
        reorder_point,
        products!inner (
          id, title, sku, current_stock, image_url
        ),
        primary_supplier:suppliers!primary_supplier_id (id, name)
      `,
      )
      .eq("shop_id", shopId)
      .eq("is_active", true),

    // POs sent but not confirmed — older than 5 days
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("purchase_orders")
      .select(
        `
        id, po_number, created_at, status,
        suppliers (id, name)
      `,
      )
      .eq("shop_id", shopId)
      .eq("status", "sent")
      .lt(
        "created_at",
        new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("created_at", { ascending: true }),

    // Confirmed POs with a passed delivery date
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("purchase_orders")
      .select(
        `
        id, po_number, confirmed_delivery_date,
        suppliers (id, name)
      `,
      )
      .eq("shop_id", shopId)
      .eq("status", "confirmed")
      .not("confirmed_delivery_date", "is", null)
      .lt("confirmed_delivery_date", now.toISOString())
      .order("confirmed_delivery_date", { ascending: true }),
  ]);

  // Filter at-risk products to only those where current_stock <= reorder_point
  type RuleRow = {
    id: string;
    reorder_point: number;
    products: { id: string; title: string; sku: string | null; current_stock: number; image_url: string | null };
    primary_supplier: { id: string; name: string } | null;
  };

  const atRiskProducts = ((atRiskResult.data ?? []) as RuleRow[])
    .filter((r) => r.products.current_stock <= r.reorder_point)
    .map((r) => ({
      ruleId: r.id,
      productId: r.products.id,
      title: r.products.title,
      sku: r.products.sku,
      currentStock: r.products.current_stock,
      reorderPoint: r.reorder_point,
      imageUrl: r.products.image_url,
      supplierName: r.primary_supplier?.name ?? null,
    }));

  type PORow = {
    id: string;
    po_number: string;
    created_at: string;
    confirmed_delivery_date?: string | null;
    suppliers: { id: string; name: string } | null;
  };

  const unconfirmedPOs = ((unconfirmedResult.data ?? []) as PORow[]).map(
    (po) => ({
      id: po.id,
      poNumber: po.po_number,
      sentAt: po.created_at,
      daysSinceSent: Math.floor(
        (now.getTime() - new Date(po.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
      supplierName: po.suppliers?.name ?? null,
      supplierId: po.suppliers?.id ?? null,
    }),
  );

  const overdueDeliveries = ((overdueResult.data ?? []) as PORow[]).map(
    (po) => ({
      id: po.id,
      poNumber: po.po_number,
      expectedDelivery: po.confirmed_delivery_date!,
      supplierName: po.suppliers?.name ?? null,
      supplierId: po.suppliers?.id ?? null,
    }),
  );

  return {
    shopName: shop.shop_name ?? session.shop,
    stats: {
      openPOs: openPOResult.count ?? 0,
      suppliers: supplierResult.count ?? 0,
      products: productResult.count ?? 0,
      atRiskCount: atRiskProducts.length,
    },
    atRiskProducts,
    unconfirmedPOs,
    overdueDeliveries,
  };
};

export { default } from "../../frontend/pages/DashboardPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
