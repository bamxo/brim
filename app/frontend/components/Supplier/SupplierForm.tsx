import { useState, useEffect } from "react";
import { useNavigate, useSubmit } from "react-router";

type Supplier = {
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
};

type Props = {
  supplier: Supplier;
  errors: Record<string, string | undefined>;
  /** actionData object reference — used to detect a successful save */
  actionData: { success?: boolean } | null | undefined;
};

export default function SupplierForm({ supplier, errors, actionData }: Props) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const [savedOk, setSavedOk] = useState(false);

  // Re-fires on every new actionData reference, even when success stays true
  useEffect(() => {
    if (actionData?.success) {
      setSavedOk(true);
      const t = setTimeout(() => setSavedOk(false), 4000);
      return () => clearTimeout(t);
    }
  }, [actionData]); // eslint-disable-line react-hooks/exhaustive-deps

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
    submit(fd, { method: "post" });
  };

  return (
    <s-section heading="Supplier information">
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
          <s-text-area
            name="notes"
            label="Notes"
            value={supplier.notes ?? ""}
            help-text="Internal notes about this supplier"
          />
        </s-stack>
      </form>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "16px",
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: savedOk ? "#007a5a" : "transparent",
            fontWeight: 500,
            transition: "color 0.2s",
          }}
        >
          ✓ Changes saved
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <s-button onClick={() => navigate("/app/suppliers")}>Cancel</s-button>
          <s-button variant="primary" onClick={handleSave}>
            Save changes
          </s-button>
        </div>
      </div>
    </s-section>
  );
}
