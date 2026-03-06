import { useActionData, useLoaderData, useNavigate, useSubmit } from "react-router";

type LoaderData = {
  supplier: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
    lead_time_days: number | null;
  };
};

export default function SupplierDetailPage() {
  const { supplier } = useLoaderData<LoaderData>();
  const actionData = useActionData<{ errors?: Record<string, string | undefined>; success?: boolean }>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

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
          const form = document.getElementById("supplier-form") as HTMLFormElement;
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

      {actionData?.success && (
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
              value={
                supplier.lead_time_days != null
                  ? String(supplier.lead_time_days)
                  : ""
              }
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
