export type Carrier = "ups" | "fedex" | "usps" | "dhl" | "unknown";
export type TrackingConfidence = "high" | "medium" | "low" | "none";

export type TrackingResult = {
  trackingNumber: string | null;
  carrier: Carrier;
  confidence: TrackingConfidence;
};

const LABEL_REGEX =
  /(?:tracking(?:\s*(?:number|no\.?|#))?|track|awb)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{6,30}[A-Z0-9])/i;

const UPS_REGEX = /\b1Z[A-Z0-9]{16}\b/;
const FEDEX_REGEX = /(?<![\(\d])\b\d{12}\b(?!\d)|(?<![\(\d])\b\d{15}\b(?!\d)/;
const USPS_REGEX = /\b9[0-9]{21}\b|\b\d{20,22}\b/;
const DHL_REGEX = /(?<![\d])\b\d{10,11}\b(?!\d)/;

function normalize(raw: string): string {
  return raw.replace(/[\s\-]/g, "").toUpperCase();
}

function classifyCarrier(normalized: string): Carrier {
  if (UPS_REGEX.test(normalized)) return "ups";
  if (/^\d{12}$|^\d{15}$/.test(normalized)) return "fedex";
  if (/^9\d{21}$|^\d{20,22}$/.test(normalized)) return "usps";
  if (/^\d{10,11}$/.test(normalized)) return "dhl";
  return "unknown";
}

export function extractTracking(text: string): TrackingResult {
  if (!text) return { trackingNumber: null, carrier: "unknown", confidence: "none" };

  const labeled = text.match(LABEL_REGEX);
  if (labeled) {
    const candidate = normalize(labeled[1]);
    if (candidate.length >= 8) {
      return {
        trackingNumber: candidate,
        carrier: classifyCarrier(candidate),
        confidence: "high",
      };
    }
  }

  const ups = text.match(UPS_REGEX);
  if (ups) return { trackingNumber: ups[0].toUpperCase(), carrier: "ups", confidence: "medium" };

  const fedex = text.match(FEDEX_REGEX);
  if (fedex) return { trackingNumber: fedex[0], carrier: "fedex", confidence: "medium" };

  const usps = text.match(USPS_REGEX);
  if (usps) return { trackingNumber: usps[0], carrier: "usps", confidence: "medium" };

  const dhl = text.match(DHL_REGEX);
  if (dhl) return { trackingNumber: dhl[0], carrier: "dhl", confidence: "medium" };

  return { trackingNumber: null, carrier: "unknown", confidence: "none" };
}
