import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import PurchaseOrderDocument from "./PurchaseOrderDocument";
import type { PurchaseOrderPdfData } from "./types";

export async function generatePurchaseOrderPdf(
  data: PurchaseOrderPdfData,
): Promise<Buffer> {
  const doc = React.createElement(PurchaseOrderDocument, { data });
  // @ts-expect-error renderToBuffer returns a promise of Buffer-compatible NodeJS.ReadableStream
  const buffer: Buffer = await renderToBuffer(doc);
  return buffer;
}

export type { PurchaseOrderPdfData };
