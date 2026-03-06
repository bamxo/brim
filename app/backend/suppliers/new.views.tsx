import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { createSupplier } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const leadTimeDays = formData.get("lead_time_days")
    ? Number(formData.get("lead_time_days"))
    : null;

  if (!name) return { errors: { name: "Name is required" } };
  if (!email) return { errors: { email: "Email is required" } };

  const { id, error } = await createSupplier(shop.id, {
    name,
    email,
    phone,
    notes,
    lead_time_days: leadTimeDays,
  });

  if (error) return { errors: { form: error } };

  return redirect(`/app/suppliers/${id}`);
};

export { default } from "../../frontend/pages/NewSupplierPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
