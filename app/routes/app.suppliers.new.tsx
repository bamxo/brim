import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { useActionData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("suppliers")
    .insert({
      shop_id: shop.id,
      name,
      email,
      phone,
      notes,
      lead_time_days: leadTimeDays,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return { errors: { form: error.message } };

  return redirect(`/app/suppliers/${data.id}`);
};

export default function NewSupplier() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const errors = actionData?.errors ?? {};

  return (
    <s-page heading="Add supplier">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById(
            "supplier-form",
          ) as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
      >
        Save supplier
      </s-button>
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/suppliers")}
      >
        Cancel
      </s-button>

      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save supplier">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <form id="supplier-form" method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              name="name"
              label="Supplier name"
              required
              value=""
              error={"name" in errors ? errors.name : undefined}
            />
            <s-email-field
              name="email"
              label="Email address"
              required
              value=""
              help-text="Purchase orders will be sent to this address"
              error={"email" in errors ? errors.email : undefined}
            />
            <s-text-field
              name="phone"
              label="Phone number"
              type="tel"
              value=""
              help-text="Optional — for WhatsApp or clipboard sharing"
            />
            <s-number-field
              name="lead_time_days"
              label="Lead time (days)"
              min="0"
              value=""
              help-text="Typical days between placing and receiving an order"
            />
            <s-text-area
              name="notes"
              label="Notes"
              value=""
              help-text="Internal notes about this supplier"
            />
          </s-stack>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
