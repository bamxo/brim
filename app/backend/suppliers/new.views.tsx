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
  const address1 = String(formData.get("address1") ?? "").trim() || null;
  const address2 = String(formData.get("address2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const zip = String(formData.get("zip") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;

  if (!name) return { errors: { name: "Name is required" } };
  if (!email) return { errors: { email: "Email is required" } };

  const { id, error } = await createSupplier(shop.id, {
    name,
    email,
    phone,
    notes,
    address1,
    address2,
    city,
    province,
    zip,
    country,
  });

  if (error) return { errors: { form: error } };

  return redirect(`/app/suppliers/${id}`);
};

export { default } from "../../frontend/pages/NewSupplierPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
