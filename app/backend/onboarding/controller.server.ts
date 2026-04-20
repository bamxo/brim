import supabase from "../../db/supabase.server";

export type OnboardingStatus = {
  gmailConnected: boolean;
  gmailSkipped: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

export async function getOnboardingStatus(
  shopId: string
): Promise<OnboardingStatus> {
  const [gmailResult, supplierResult, reorderResult, shopResult] = await Promise.all([
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shops")
      .select("onboarding_gmail_skipped")
      .eq("id", shopId)
      .single(),
  ]);

  const gmailConnected = (gmailResult.count ?? 0) > 0;
  const gmailSkipped = shopResult.data?.onboarding_gmail_skipped ?? false;
  const supplierAdded = (supplierResult.count ?? 0) > 0;
  const reorderConfigured = (reorderResult.count ?? 0) > 0;
  const gmailDone = gmailConnected || gmailSkipped;

  return {
    gmailConnected,
    gmailSkipped,
    supplierAdded,
    reorderConfigured,
    allComplete: gmailDone && supplierAdded && reorderConfigured,
  };
}

export async function resetOnboarding(shopId: string): Promise<void> {
  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shop_google_accounts")
      .update({ is_disconnected: true })
      .eq("shop_id", shopId),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("suppliers")
      .update({ is_active: false })
      .eq("shop_id", shopId),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("reorder_rules").delete().eq("shop_id", shopId),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shops")
      .update({ onboarding_gmail_skipped: false })
      .eq("id", shopId),
  ]);
}
