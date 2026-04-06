import { useLoaderData, useNavigate } from "react-router";
import TitleBar from "../components/Header/TitleBar";
import SupplierTable, { type Supplier } from "../components/Supplier/SupplierTable";

type LoaderData = { suppliers: Supplier[] };

export default function SuppliersPage() {
  const { suppliers } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  return (
    <TitleBar heading="Suppliers">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/suppliers/new")}
      >
        Add supplier
      </s-button>

      <SupplierTable suppliers={suppliers} />
    </TitleBar>
  );
}
