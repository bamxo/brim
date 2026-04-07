export type PdfAddress = {
  company: string | null;
  name: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
};

export type PdfLineItem = {
  product_name: string;
  variant_title: string | null;
  sku: string | null;
  quantity_ordered: number;
  unit_cost: number | null;
  line_total: number | null;
};

export type PurchaseOrderPdfData = {
  poNumber: string;
  poDate: string;
  requestedDeliveryDate: string | null;
  notes: string | null;
  currency: string;
  totalAmount: number;
  billTo: PdfAddress;
  vendor: PdfAddress;
  shipTo: PdfAddress;
  lineItems: PdfLineItem[];
};
