import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  getOnboardingStatus,
  resetOnboarding,
} from "../onboarding/controller.server";
import supabase from "../../db/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "reset-onboarding") {
    await resetOnboarding(shop.id);
    return { resetOk: true };
  }

  return { error: "Unknown intent" };
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const shopId = shop.id;
  const url = new URL(request.url);
  // eslint-disable-next-line no-undef
  const forceOnboarding =
    process.env.FORCE_ONBOARDING === "true" || url.searchParams.get("force") === "1";
  const onboardingStatus = await getOnboardingStatus(shopId);

  const now = new Date();

  // Run all queries in parallel
  const [
    openPOResult,
    supplierResult,
    productResult,
    atRiskResult,
    unconfirmedResult,
    overdueResult,
    draftResult,
    arrivingResult,
    stockLevelsResult,
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

    // Draft POs waiting to be sent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("purchase_orders")
      .select(
        `
        id, po_number, created_at,
        suppliers (id, name)
      `,
      )
      .eq("shop_id", shopId)
      .eq("status", "draft")
      .order("created_at", { ascending: true }),

    // Confirmed POs with an upcoming delivery date (arriving soon)
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
      .in("status", ["confirmed", "in_transit"])
      .not("confirmed_delivery_date", "is", null)
      .gte("confirmed_delivery_date", now.toISOString())
      .order("confirmed_delivery_date", { ascending: true }),

    // All active rules for days-of-stock chart (sorted by stock ratio asc)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("reorder_rules")
      .select(
        `
        id,
        reorder_point,
        products!inner (
          id, title, current_stock
        )
      `,
      )
      .eq("shop_id", shopId)
      .eq("is_active", true),
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

  const draftPOs = ((draftResult.data ?? []) as PORow[]).map((po) => ({
    id: po.id,
    poNumber: po.po_number,
    createdAt: po.created_at,
    supplierName: po.suppliers?.name ?? null,
    supplierId: po.suppliers?.id ?? null,
  }));

  type StockRow = {
    id: string;
    reorder_point: number;
    products: { id: string; title: string; current_stock: number };
  };

  // Sort by stock/reorder_point ratio ascending (least days first), take top 5
  const stockLevels = ((stockLevelsResult.data ?? []) as StockRow[])
    .map((r) => ({
      productId: r.products.id,
      title: r.products.title,
      currentStock: r.products.current_stock,
      reorderPoint: r.reorder_point,
      // rough days estimate: if current_stock <= 0, 0 days; else scale by reorder_point as ~30-day proxy
      daysEstimate: r.reorder_point > 0
        ? Math.round((r.products.current_stock / r.reorder_point) * 30)
        : r.products.current_stock > 0 ? 999 : 0,
    }))
    .sort((a, b) => a.daysEstimate - b.daysEstimate)
    .slice(0, 5);

  const arrivingSoon = ((arrivingResult.data ?? []) as PORow[]).map((po) => ({
    id: po.id,
    poNumber: po.po_number,
    expectedDelivery: po.confirmed_delivery_date!,
    supplierName: po.suppliers?.name ?? null,
    supplierId: po.suppliers?.id ?? null,
  }));

  return {
    shopName: shop.shop_name ?? session.shop,
    shopId,
    onboardingStatus,
    forceOnboarding,
    stats: {
      openPOs: openPOResult.count ?? 0,
      suppliers: supplierResult.count ?? 0,
      products: productResult.count ?? 0,
      atRiskCount: atRiskProducts.length,
      arrivingCount: arrivingSoon.length,
    },
    atRiskProducts,
    unconfirmedPOs,
    overdueDeliveries,
    draftPOs,
    arrivingSoon,
    stockLevels,
  };
};

export { default } from "../../frontend/pages/DashboardPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
