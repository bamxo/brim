import supabase from "../../db/supabase.server";

export async function getActiveSuppliers(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("suppliers")
    .select("id, name, email, phone, is_active")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
  }[];
}

export async function getActiveSuppliersMinimal(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("suppliers")
    .select("id, name")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("name");

  return (data ?? []) as { id: string; name: string }[];
}

export async function getSupplierById(shopId: string, supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("suppliers")
    .select("id, name, email, phone, notes")
    .eq("id", supplierId)
    .eq("shop_id", shopId)
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  };
}

export async function createSupplier(
  shopId: string,
  data: {
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error } = await (supabase as any)
    .from("suppliers")
    .insert({ shop_id: shopId, ...data, is_active: true })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: row.id as string, error: null };
}

export async function updateSupplier(
  shopId: string,
  supplierId: string,
  data: {
    name: string;
    email: string;
    phone: string | null;
    notes: string | null;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("suppliers")
    .update(data)
    .eq("id", supplierId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deactivateSupplier(shopId: string, supplierId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("suppliers")
    .update({ is_active: false })
    .eq("id", supplierId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteSupplier(shopId: string, supplierId: string) {
  // Delete reorder rules where this is the primary supplier — they're useless without one.
  // Rules where this was only the backup supplier are kept but backup is nulled out.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("reorder_rules")
    .delete()
    .eq("primary_supplier_id", supplierId)
    .eq("shop_id", shopId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("reorder_rules")
    .update({ backup_supplier_id: null })
    .eq("backup_supplier_id", supplierId)
    .eq("shop_id", shopId);

  // Retain historical POs but unlink the supplier so the record is preserved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("purchase_orders")
    .update({ supplier_id: null })
    .eq("supplier_id", supplierId)
    .eq("shop_id", shopId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("suppliers")
    .delete()
    .eq("id", supplierId)
    .eq("shop_id", shopId);

  if (error) return { error: error.message };
  return { error: null };
}
