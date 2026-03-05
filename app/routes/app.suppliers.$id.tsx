import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect } from "react-router";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: supplier, error } = await (supabase as any)
    .from("suppliers")
    .select("*")
    .eq("id", params.id)
    .eq("shop_id", shop.id)
    .single();

  if (error || !supplier) throw new Response("Supplier not found", { status: 404 });

  return { supplier };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", params.id)
      .eq("shop_id", shop.id);

    if (error) return { errors: { form: error.message } };
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("suppliers")
    .update({ name, email, phone, notes, lead_time_days: leadTimeDays })
    .eq("id", params.id)
    .eq("shop_id", shop.id);

  if (error) return { errors: { form: error.message } };
  return { errors: {}, success: true };
};

export default function EditSupplier() {
  const { supplier } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const errors = actionData?.errors ?? {};

  const handleDelete = () => {
    if (!confirm(`Delete ${supplier.name}? This cannot be undone.`)) return;
    const formData = new FormData();
    formData.append("intent", "delete");
    submit(formData, { method: "post" });
  };

  return (
    <s-page heading={supplier.name}>
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
        Save changes
      </s-button>
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/suppliers")}
      >
        Cancel
      </s-button>

      {"success" in actionData! && actionData.success && (
        <s-banner tone="success" heading="Supplier updated" />
      )}
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
              value={supplier.name}
              error={"name" in errors ? errors.name : undefined}
            />
            <s-email-field
              name="email"
              label="Email address"
              required
              value={supplier.email}
              help-text="Purchase orders will be sent to this address"
              error={"email" in errors ? errors.email : undefined}
            />
            <s-text-field
              name="phone"
              label="Phone number"
              value={supplier.phone ?? ""}
              help-text="Optional — for WhatsApp or clipboard sharing"
            />
            <s-number-field
              name="lead_time_days"
              label="Lead time (days)"
              min={0}
              value={supplier.lead_time_days != null ? String(supplier.lead_time_days) : ""}
              help-text="Typical days between placing and receiving an order"
            />
            <s-text-area
              name="notes"
              label="Notes"
              value={supplier.notes ?? ""}
              help-text="Internal notes about this supplier"
            />
          </s-stack>
        </form>
      </s-section>

      <s-section heading="Danger zone" slot="aside">
        <s-paragraph>
          Deactivating this supplier will remove them from all reorder rules.
          Existing purchase orders will not be affected.
        </s-paragraph>
        <s-button tone="critical" onClick={handleDelete}>
          Deactivate supplier
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
