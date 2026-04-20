import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getOnboardingStatus } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const url = new URL(request.url);
  const forceOnboarding = process.env.FORCE_ONBOARDING === "true" || url.searchParams.get("force") === "1";
  const status = await getOnboardingStatus(shop.id);

  if (status.allComplete && !forceOnboarding) {
    const params = new URLSearchParams();
    for (const key of ["shop", "host", "embedded", "session"]) {
      const val = url.searchParams.get(key);
      if (val) params.set(key, val);
    }
    const dest = params.size > 0 ? `/app?${params.toString()}` : "/app";
    return redirect(dest);
  }

  return { status, shopId: shop.id, forceOnboarding };
};

export { default } from "../../frontend/pages/OnboardingPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
