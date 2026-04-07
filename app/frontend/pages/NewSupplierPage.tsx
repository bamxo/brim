import { useActionData, useNavigate, useSubmit } from "react-router";
import TitleBar from "../components/Header/TitleBar";

export default function NewSupplierPage() {
  const actionData = useActionData<{ errors?: Record<string, string | undefined> }>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const errors = (actionData?.errors ?? {}) as Record<string, string | undefined>;

  const handleSave = () => {
    const form = document.getElementById("supplier-form") as HTMLFormElement;
    if (!form) return;
    const get = (name: string) =>
      (form.querySelector(`[name="${name}"]`) as HTMLElement & { value: string })?.value ?? "";
    const fd = new FormData();
    fd.append("name", get("name"));
    fd.append("email", get("email"));
    fd.append("phone", get("phone"));
    fd.append("notes", get("notes"));
    fd.append("address1", get("address1"));
    fd.append("address2", get("address2"));
    fd.append("city", get("city"));
    fd.append("province", get("province"));
    fd.append("zip", get("zip"));
    fd.append("country", get("country"));
    submit(fd, { method: "post" });
  };

  return (
    <TitleBar heading="Add supplier" breadcrumbs={[{ label: "Suppliers", href: "/app/suppliers" }]}>
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
              error={"name" in errors ? errors.name : undefined}
            />
            <s-email-field
              name="email"
              label="Email address"
              required
              help-text="Purchase orders will be sent to this address"
              error={"email" in errors ? errors.email : undefined}
            />
            <s-text-field
              name="phone"
              label="Phone number"
              help-text="Optional — for WhatsApp or clipboard sharing"
            />
            <s-text-area
              name="notes"
              label="Notes"
              help-text="Internal notes about this supplier"
            />
            <s-text-field
              name="address1"
              label="Address line 1"
            />
            <s-text-field
              name="address2"
              label="Address line 2"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <s-text-field
                name="city"
                label="City"
              />
              <s-text-field
                name="province"
                label="State / Province"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <s-text-field
                name="zip"
                label="ZIP / Postal code"
              />
              <s-text-field
                name="country"
                label="Country"
              />
            </div>
          </s-stack>
        </form>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
          <s-button onClick={() => navigate("/app/suppliers")}>Cancel</s-button>
          <s-button variant="primary" onClick={handleSave}>Save supplier</s-button>
        </div>
      </s-section>
    </TitleBar>
  );
}
