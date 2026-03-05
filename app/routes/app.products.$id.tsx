import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useActionData, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../lib/shop.server";
import supabase from "../supabase.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, error: productError } = await (supabase as any)
    .from("products")
    .select("*")
    .eq("id", params.id)
    .eq("shop_id", shop.id)
    .single();

  if (productError || !product) {
    throw new Response("Product not found", { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rule } = await (supabase as any)
    .from("reorder_rules")
    .select("*, primary_supplier:suppliers!primary_supplier_id(*), backup_supplier:suppliers!backup_supplier_id(*)")
    .eq("product_id", params.id)
    .eq("shop_id", shop.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suppliers } = await (supabase as any)
    .from("suppliers")
    .select("id, name")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .order("name");

  return { product, rule, suppliers: suppliers ?? [] };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete-rule") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("reorder_rules")
      .update({ is_active: false })
      .eq("product_id", params.id)
      .eq("shop_id", shop.id);
    return { success: true, deleted: true, errors: {} };
  }

  const reorderPoint = Number(formData.get("reorder_point"));
  const reorderQuantity = Number(formData.get("reorder_quantity"));
  const primarySupplierId = formData.get("primary_supplier_id") as string | null;
  const backupSupplierId = (formData.get("backup_supplier_id") as string) || null;
  const unitCost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null;

  if (!reorderPoint || reorderPoint < 0) {
    return { errors: { reorder_point: "Reorder point must be a positive number" }, success: false };
  }
  if (!reorderQuantity || reorderQuantity <= 0) {
    return { errors: { reorder_quantity: "Reorder quantity must be greater than 0" }, success: false };
  }
  if (!primarySupplierId) {
    return { errors: { primary_supplier_id: "A primary supplier is required" }, success: false };
  }

  const payload = {
    shop_id: shop.id,
    product_id: params.id,
    primary_supplier_id: primarySupplierId,
    backup_supplier_id: backupSupplierId || null,
    reorder_point: reorderPoint,
    reorder_quantity: reorderQuantity,
    unit_cost: unitCost,
    is_active: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("reorder_rules")
    .upsert(payload, { onConflict: "shop_id,product_id" });

  if (error) return { errors: { form: error.message }, success: false };
  return { success: true, deleted: false, errors: {} };
};

type Supplier = { id: string; name: string };

export default function ProductDetail() {
  const { product, rule, suppliers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const errors = actionData?.errors ?? {};

  const supplierOptions = [
    { label: "— None —", value: "" },
    ...suppliers.map((s: Supplier) => ({ label: s.name, value: s.id })),
  ];

  const stockTone =
    rule && product.current_stock <= rule.reorder_point ? "warning" : "success";

  return (
    <s-page heading={product.title}>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          const form = document.getElementById("rule-form") as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
      >
        Save rule
      </s-button>
      <s-button
        slot="secondary-action"
        onClick={() => navigate("/app/products")}
      >
        Back to products
      </s-button>

      {actionData?.success && !actionData?.deleted && (
        <s-banner tone="success" heading="Reorder rule saved" />
      )}
      {"form" in errors && (
        <s-banner tone="critical" heading="Could not save rule">
          <s-paragraph>{errors.form}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Product info" slot="aside">
        <s-paragraph>
          <s-text>Variant: </s-text>
          <s-text>{product.variant_title ?? "Default"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>SKU: </s-text>
          <s-text>{product.sku ?? "—"}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Current stock: </s-text>
          <s-badge tone={stockTone}>{String(product.current_stock)}</s-badge>
        </s-paragraph>
        {product.last_synced_at && (
          <s-paragraph>
            <s-text>Last synced: </s-text>
            <s-text>
              {new Date(product.last_synced_at).toLocaleString()}
            </s-text>
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Reorder rule">
        <form id="rule-form" method="post">
          <s-stack direction="block" gap="base">
            <s-number-field
              name="reorder_point"
              label="Reorder point"
              min="0"
              required
              value={rule ? String(rule.reorder_point) : ""}
              help-text="When stock drops to this level, a draft purchase order is created"
              error={"reorder_point" in errors ? errors.reorder_point : undefined}
            />
            <s-number-field
              name="reorder_quantity"
              label="Reorder quantity"
              min="1"
              required
              value={rule ? String(rule.reorder_quantity) : ""}
              help-text="How many units to order each time"
              error={"reorder_quantity" in errors ? errors.reorder_quantity : undefined}
            />
            <s-number-field
              name="unit_cost"
              label="Unit cost"
              min="0"
              step="0.01"
              value={rule?.unit_cost != null ? String(rule.unit_cost) : ""}
              help-text="Used to calculate PO total amounts"
            />
            <s-select
              name="primary_supplier_id"
              label="Primary supplier"
              required
              value={rule?.primary_supplier_id ?? ""}
              options={JSON.stringify(supplierOptions)}
              error={"primary_supplier_id" in errors ? errors.primary_supplier_id : undefined}
            />
            <s-select
              name="backup_supplier_id"
              label="Backup supplier"
              value={rule?.backup_supplier_id ?? ""}
              options={JSON.stringify(supplierOptions)}
              help-text="Used if the primary supplier is unavailable"
            />
          </s-stack>
        </form>
      </s-section>

      {rule?.is_active && (
        <s-section heading="Danger zone" slot="aside">
          <s-paragraph>
            Disabling this rule will stop Brim from automatically creating
            purchase orders for this product.
          </s-paragraph>
          <form method="post">
            <input type="hidden" name="intent" value="delete-rule" />
            <s-button tone="critical" submit>
              Disable reorder rule
            </s-button>
          </form>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
