import supabase from "../../db/supabase.server";

export async function getShopSettings(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("shop_settings")
    .select("*")
    .eq("shop_id", shopId)
    .single();

  return data as {
    notification_channel: string | null;
    default_send_method: string | null;
    critical_stock_threshold: number | null;
    supplier_chase_days: number | null;
    delivery_reminder_days_before: number | null;
  } | null;
}

export async function upsertShopSettings(
  shopId: string,
  payload: {
    notification_channel: FormDataEntryValue | null;
    default_send_method: FormDataEntryValue | null;
    critical_stock_threshold: number;
    supplier_chase_days: number;
    delivery_reminder_days_before: number;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shop_settings")
    .upsert({ shop_id: shopId, ...payload }, { onConflict: "shop_id" });

  if (error) return { error: error.message };
  return { error: null };
}
