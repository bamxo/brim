import { StyleSheet } from "@react-pdf/renderer";

const DARK = "#1a1a1a";
const MUTED = "#555555";
const BORDER = "#cccccc";
const BG_HEADER = "#1a1a1a";
const BG_TOTAL = "#f0f0f0";

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: DARK,
  },

  // ── Header ──────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  poTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  headerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    marginBottom: 2,
  },
  headerLabel: {
    fontSize: 8,
    color: MUTED,
  },
  headerValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },

  // ── Address blocks ──────────────────────────────────────────
  addressRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 12,
    marginBottom: 16,
  },
  addressBlock: {
    flex: 1,
    paddingRight: 12,
  },
  addressBlockMiddle: {
    flex: 1,
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  addressBlockLast: {
    flex: 1,
    paddingLeft: 12,
  },
  addressLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressCompany: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 9,
    marginBottom: 1,
    color: DARK,
  },

  // ── Line items table ────────────────────────────────────────
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: BG_HEADER,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 28,
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellMuted: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  colDescription: { flex: 3 },
  colQty: { width: 40, textAlign: "center" },
  colUnitPrice: { width: 70, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },

  // ── Footer / totals ────────────────────────────────────────
  footerRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginTop: 8,
    paddingTop: 12,
  },
  notesBlock: {
    flex: 1,
    paddingRight: 24,
  },
  notesLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  totalsBlock: {
    width: 200,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 9,
  },
  totalsValue: {
    fontSize: 9,
    textAlign: "right",
  },
  totalsFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: BG_TOTAL,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  totalsFinalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalsFinalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },

  // ── Page footer ─────────────────────────────────────────────
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
  },
});
