import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import supabase from "../../db/supabase.server";
import { exchangeCode, saveGoogleAccount } from "../../backend/google/oauth.server";
import { startWatch } from "../../backend/google/pubsub.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(`/app/settings?google_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shop } = await (supabase as any)
    .from("shops")
    .select("id, shopify_domain")
    .eq("id", state)
    .single();

  if (!shop) {
    return new Response("Invalid state", { status: 400 });
  }

  const tokens = await exchangeCode(code);
  await saveGoogleAccount(shop.id, tokens);

  try {
    await startWatch(shop.id);
  } catch (err) {
    console.error("Failed to start Gmail watch:", err);
  }

  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Gmail connected</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f6f6f7;">
  <div style="text-align:center;padding:32px;">
    <div style="font-size:48px;margin-bottom:16px;">✓</div>
    <h2 style="margin:0 0 8px;">Gmail connected</h2>
    <p style="color:#666;margin:0 0 24px;">You can close this tab and return to Brim.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: "gmail_connected" }, "*");
      }
      setTimeout(() => window.close(), 1500);
    </script>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } },
  );
};
