import { Resend } from "resend";
import supabase from "../../db/supabase.server";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_ADDRESS ?? "orders@brimapp.com";
const APP_URL = process.env.APP_URL ?? "https://brimapp.com";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  purchase_order_id: string | null;
};

export async function getUnreadNotifications(
  shopId: string,
  limit = 5,
): Promise<Notification[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("notifications")
    .select(
      "id, type, title, body, action_url, is_read, created_at, purchase_order_id",
    )
    .eq("shop_id", shopId)
    .eq("is_read", false)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch notifications:", error.message);
    return [];
  }

  return (data ?? []) as Notification[];
}

export async function markNotificationRead(notificationId: string): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function markNotificationDismissed(notificationId: string): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ is_dismissed: true })
    .eq("id", notificationId);

  if (error) return { error: error.message };
  return { error: null };
}

type ReorderNotificationPayload = {
  shopId: string;
  poId: string;
  poNumber: string;
  productNames: string[];
};

export async function dispatchReorderNotification(
  payload: ReorderNotificationPayload,
): Promise<void> {
  const { shopId, poId, poNumber, productNames } = payload;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from("shop_settings")
    .select("notification_channel")
    .eq("shop_id", shopId)
    .single();

  const channel: string = settings?.notification_channel ?? "email";

  const productList =
    productNames.length <= 3
      ? productNames.join(", ")
      : `${productNames.slice(0, 3).join(", ")} and ${productNames.length - 3} more`;

  const title = `Reorder needed — ${poNumber}`;
  const body = `${productList} hit the reorder point. A draft purchase order has been created for your review.`;
  const actionUrl = `/app/purchase-orders/${poId}`;

  const sentVia: string[] = [];
  if (channel === "shopify" || channel === "both") sentVia.push("shopify");
  if (channel === "email" || channel === "both") sentVia.push("email");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from("notifications")
    .insert({
      shop_id: shopId,
      purchase_order_id: poId,
      type: "reorder_triggered",
      title,
      body,
      action_url: actionUrl,
      is_read: false,
      sent_via: sentVia,
    });

  if (insertError) {
    console.error("Failed to insert notification:", insertError.message);
  }

  if (channel === "email" || channel === "both") {
    await sendReorderEmail(shopId, poNumber, productList, actionUrl);
  }
}

async function sendReorderEmail(
  shopId: string,
  poNumber: string,
  productSummary: string,
  actionPath: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shop } = await (supabase as any)
    .from("shops")
    .select("email, shop_name, shopify_domain")
    .eq("id", shopId)
    .single();

  if (!shop?.email) {
    console.error("No shop email found — skipping reorder email");
    return;
  }

  const reviewUrl = `${APP_URL}${actionPath}`;

  try {
    await resend.emails.send({
      from: FROM,
      to: shop.email,
      subject: `Reorder alert — ${poNumber}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin-top:0;">Reorder Alert</h2>
  <p><strong>${poNumber}</strong> has been created because the following products hit their reorder point:</p>
  <p style="background:#f5f5f5;padding:12px;border-radius:6px;">${productSummary}</p>
  <p>
    <a href="${reviewUrl}"
       style="display:inline-block;padding:10px 20px;background:#000;color:#fff;
              text-decoration:none;border-radius:6px;font-weight:600;">
      Review Purchase Order
    </a>
  </p>
  <p style="margin-top:32px;color:#888;font-size:12px;">
    Sent by ${shop.shop_name ?? shop.shopify_domain} via Brim
  </p>
</body>
</html>`,
    });
  } catch (err) {
    console.error("Failed to send reorder email:", err);
  }
}
