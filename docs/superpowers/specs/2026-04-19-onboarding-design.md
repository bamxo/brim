# Onboarding Flow Design

## Overview

A post-install onboarding page shown to new users before they reach the dashboard. Users must complete 3 setup steps; until all are done, every `/app/*` visit redirects to `/app/onboarding`. Once all steps are complete, the redirect never fires again.

---

## Data & Completion Logic

Step completion is derived from existing tables — no new schema changes required.

| Step | Complete when |
|------|--------------|
| Connect Gmail | `shop_google_accounts` row exists for `shop_id` AND `is_disconnected = false` |
| Connect first supplier | `suppliers` count > 0 for `shop_id` AND `is_active = true` |
| Configure a product | `reorder_rules` count > 0 for any product belonging to this shop |

A new `getOnboardingStatus(shopId)` function in `app/backend/onboarding/controller.server.ts` runs all 3 queries in parallel and returns:

```ts
{
  gmailConnected: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean; // gmailConnected && supplierAdded && reorderConfigured
}
```

---

## Routing & Redirect Gate

**New route:** `app/onboarding` → `backend/onboarding/views.tsx`, added as a child of the `app` layout route in `routes.ts`.

**Redirect logic in `frontend/app.tsx` loader:**

1. Call `getOnboardingStatus(shopId)`
2. If `FORCE_ONBOARDING=true` env var is set, treat `allComplete = false`
3. If `!allComplete` AND current path is not `/app/onboarding` → `redirect("/app/onboarding")`
4. If `allComplete` AND current path is `/app/onboarding` → `redirect("/app")`

Rule 4 is suppressed when `FORCE_ONBOARDING=true` so the page stays visible for testing.

---

## Onboarding Page UI

Renders inside the existing `app` layout (gets `AppProvider`, Shopify iframe context) but uses a custom full-page centered card layout — no `TitleBar`, no nav actions.

**Layout:** Two-column card — steps list on the left, `checklist.svg` graphic on the right.

**Step rows (free navigation — no enforced order):**

| # | Label | CTA button | Action |
|---|-------|-----------|--------|
| 1 | Connect Gmail and allow access | "Connect Gmail" | `window.open("/auth/google/start?shop_id=...", "_blank")` |
| 2 | Connect first supplier | "Add Supplier" | `navigate("/app/suppliers/new")` |
| 3 | Configure a product (set reorder point) | "Set Reorder Point" | `navigate("/app/products")` |

**Step state indicators:**
- Complete: green filled circle with checkmark
- Incomplete: empty circle

No "active" state — all steps are independently actionable.

**After Gmail OAuth:** The callback already opens in a new tab, sends `postMessage({ type: "gmail_connected" })` to the opener, then auto-closes. The onboarding page listens for this message and calls `revalidate()` — same pattern already used in `SettingsPage.tsx`. No changes needed to the callback route.

---

## Testing

**`FORCE_ONBOARDING=true` env var** — when set:
- Layout loader always redirects to `/app/onboarding` regardless of real step data
- Onboarding page loader never auto-redirects to `/app` even if `allComplete`
- Individual step indicators still reflect real DB state (useful to see which steps are actually done)

To test: add `FORCE_ONBOARDING=true` to `.env`, visit `/app`. Remove it to restore normal behavior. No database changes needed.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/backend/onboarding/controller.server.ts` | New — `getOnboardingStatus(shopId)` |
| `app/backend/onboarding/views.tsx` | New — loader + re-export of onboarding page |
| `app/frontend/pages/OnboardingPage.tsx` | New — UI component |
| `app/frontend/app.tsx` | Modify loader — add redirect gate |
| `app/routes.ts` | Modify — add `app/onboarding` route |
| `app/routes/auth.google.callback/route.tsx` | No change needed — already uses postMessage + auto-close pattern |
