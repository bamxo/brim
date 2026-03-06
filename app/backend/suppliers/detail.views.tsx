import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import {
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
} from "./controller.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const supplier = await getSupplierById(shop.id, params.id!);
  if (!supplier) throw new Response("Supplier not found", { status: 404 });

  return { supplier };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const { error } = await deactivateSupplier(shop.id, params.id!);
    if (error) return { errors: { form: error } };
    return redirect("/app/suppliers");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const leadTimeDays = formData.get("lead_time_days")
    ? Number(formData.get("lead_time_days"))
    : null;

  if (!name) return { errors: { name: "Name is required" } };
  if (!email) return { errors: { email: "Email is required" } };

  const { error } = await updateSupplier(shop.id, params.id!, {
    name,
    email,
    phone,
    notes,
    lead_time_days: leadTimeDays,
  });

  if (error) return { errors: { form: error } };
  return { errors: {}, success: true };
};

export { default } from "../../frontend/pages/SupplierDetailPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
