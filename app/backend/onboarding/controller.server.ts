import supabase from "../../db/supabase.server";

export type OnboardingStatus = {
  gmailConnected: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

export async function getOnboardingStatus(
  shopId: string
): Promise<OnboardingStatus> {
  const [gmailResult, supplierResult, reorderResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shop_google_accounts")
      .select("shop_id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_disconnected", false),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_active", true),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("reorder_rules")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
  ]);

  const gmailConnected = (gmailResult.count ?? 0) > 0;
  const supplierAdded = (supplierResult.count ?? 0) > 0;
  const reorderConfigured = (reorderResult.count ?? 0) > 0;

  return {
    gmailConnected,
    supplierAdded,
    reorderConfigured,
    allComplete: gmailConnected && supplierAdded && reorderConfigured,
  };
}
