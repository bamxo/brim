import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { PurchaseOrderPdfData, PdfAddress, PdfLineItem } from "./types";

function formatCurrency(amount: number | null, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function AddressLines({ addr }: { addr: PdfAddress }) {
  const lines: string[] = [];
  if (addr.company) lines.push(addr.company);
  if (addr.name) lines.push(addr.name);
  if (addr.address1) lines.push(addr.address1);
  if (addr.address2) lines.push(addr.address2);

  const cityLine = [addr.city, addr.province, addr.zip].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  if (addr.phone) lines.push(addr.phone);
  if (addr.email) lines.push(addr.email);

  if (lines.length === 0) return <Text style={styles.addressLine}>—</Text>;

  return (
    <>
      {lines[0] && <Text style={styles.addressCompany}>{lines[0]}</Text>}
      {lines.slice(1).map((line, i) => (
        <Text key={i} style={styles.addressLine}>{line}</Text>
      ))}
    </>
  );
}

function LineItemRow({ item, currency }: { item: PdfLineItem; currency: string }) {
  const description = item.variant_title
    ? `${item.product_name} — ${item.variant_title}`
    : item.product_name;

  return (
    <View style={styles.tableRow}>
      <View style={styles.colDescription}>
        <Text style={styles.tableCell}>{description}</Text>
        {item.sku && <Text style={styles.tableCellMuted}>SKU: {item.sku}</Text>}
      </View>
      <View style={styles.colQty}>
        <Text style={styles.tableCell}>{item.quantity_ordered}</Text>
      </View>
      <View style={styles.colUnitPrice}>
        <Text style={styles.tableCell}>{formatCurrency(item.unit_cost, currency)}</Text>
      </View>
      <View style={styles.colTotal}>
        <Text style={styles.tableCell}>{formatCurrency(item.line_total, currency)}</Text>
      </View>
    </View>
  );
}

export default function PurchaseOrderDocument({ data }: { data: PurchaseOrderPdfData }) {
  const subtotal = data.lineItems.reduce((sum, li) => sum + (li.line_total ?? 0), 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandName}>brim</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.poTitle}>PURCHASE ORDER # {data.poNumber}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerLabel}>P.O. Date</Text>
              <Text style={styles.headerValue}>{formatDate(data.poDate)}</Text>
            </View>
            {data.requestedDeliveryDate && (
              <View style={styles.headerMeta}>
                <Text style={styles.headerLabel}>Promise Date</Text>
                <Text style={styles.headerValue}>{formatDate(data.requestedDeliveryDate)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Address row ── */}
        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Bill To</Text>
            <AddressLines addr={data.billTo} />
          </View>
          <View style={styles.addressBlockMiddle}>
            <Text style={styles.addressLabel}>Vendor</Text>
            <AddressLines addr={data.vendor} />
          </View>
          <View style={styles.addressBlockLast}>
            <Text style={styles.addressLabel}>Ship To</Text>
            <AddressLines addr={data.shipTo} />
          </View>
        </View>

        {/* ── Table header ── */}
        <View style={styles.tableHeaderRow}>
          <View style={styles.colDescription}>
            <Text style={styles.tableHeaderCell}>Item Description</Text>
          </View>
          <View style={styles.colQty}>
            <Text style={styles.tableHeaderCell}>Qty</Text>
          </View>
          <View style={styles.colUnitPrice}>
            <Text style={styles.tableHeaderCell}>Unit Price</Text>
          </View>
          <View style={styles.colTotal}>
            <Text style={styles.tableHeaderCell}>Total ({data.currency})</Text>
          </View>
        </View>

        {/* ── Line items ── */}
        {data.lineItems.map((item, i) => (
          <LineItemRow key={i} item={item} currency={data.currency} />
        ))}

        {/* ── Footer: notes + totals ── */}
        <View style={styles.footerRow}>
          <View style={styles.notesBlock}>
            {data.notes && (
              <>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{data.notes}</Text>
              </>
            )}
          </View>
          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCurrency(subtotal, data.currency)}</Text>
            </View>
            <View style={styles.totalsFinal}>
              <Text style={styles.totalsFinalLabel}>Total Cost</Text>
              <Text style={styles.totalsFinalValue}>
                {formatCurrency(data.totalAmount, data.currency)} {data.currency}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Page footer ── */}
        <View style={styles.pageFooter} fixed>
          <Text>Purchase Order # {data.poNumber}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
