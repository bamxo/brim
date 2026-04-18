import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../../backend/shops/controller.server";
import {
  createOAuthClient,
  decryptAccountTokens,
  deleteGoogleAccount,
  getGoogleAccount,
} from "../../backend/google/oauth.server";
import { stopWatch } from "../../backend/google/pubsub.server";

export const loader = async () => redirect("/app/settings");

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const account = await getGoogleAccount(shop.id);

  if (account) {
    try {
      await stopWatch(shop.id);
    } catch (err) {
      console.error("Failed to stop Gmail watch:", err);
    }
    try {
      const { refreshToken } = decryptAccountTokens(account);
      const client = createOAuthClient();
      await client.revokeToken(refreshToken);
    } catch (err) {
      console.error("Failed to revoke Google token:", err);
    }
    await deleteGoogleAccount(shop.id);
  }

  return redirect(`/app/settings?shop=${encodeURIComponent(session.shop)}&google_disconnected=1`);
};

// Satisfy type imports
export type { LoaderFunctionArgs };
