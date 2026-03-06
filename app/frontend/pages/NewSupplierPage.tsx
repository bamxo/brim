import { useActionData, useNavigate } from "react-router";

export default function NewSupplierPage() {
  const actionData = useActionData<{ errors?: Record<string, string | undefined> }>();
  const navigate = useNavigate();
  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  return (
    <s-page heading="Add supplier">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById("supplier-form") as HTMLFormElement;
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
              value=""
              help-text="Optional — for WhatsApp or clipboard sharing"
            />
            <s-number-field
              name="lead_time_days"
              label="Lead time (days)"
              min={0}
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
