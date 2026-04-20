import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getOnboardingStatus } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const forceOnboarding = process.env.FORCE_ONBOARDING === "true";
  const status = await getOnboardingStatus(shop.id);

  if (status.allComplete && !forceOnboarding) {
    return redirect("/app");
  }

  return { status, shopId: shop.id };
};

export { default } from "../../frontend/pages/OnboardingPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
