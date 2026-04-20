# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show new Brim users a 3-step onboarding page (connect Gmail, add supplier, configure reorder point) before they can access the dashboard; gate is bypassed once all steps are complete or when `FORCE_ONBOARDING=true`.

**Architecture:** A new `getOnboardingStatus` function queries existing tables to derive step completion. The `app` layout loader checks status and redirects to `/app/onboarding` if incomplete. A new `OnboardingPage` component renders the checklist UI with `checklist.svg`. `FORCE_ONBOARDING=true` env var overrides completion for local testing.

**Tech Stack:** React Router v7, Shopify Polaris web components (`s-*`), Supabase, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/backend/onboarding/controller.server.ts` | Create | `getOnboardingStatus(shopId)` — 3 parallel Supabase queries |
| `app/backend/onboarding/views.tsx` | Create | Route loader + re-export of `OnboardingPage` |
| `app/frontend/pages/OnboardingPage.tsx` | Create | Full onboarding UI component |
| `app/frontend/app.tsx` | Modify | Add redirect gate in loader |
| `app/routes.ts` | Modify | Register `/app/onboarding` route |

---

### Task 1: `getOnboardingStatus` controller

**Files:**
- Create: `app/backend/onboarding/controller.server.ts`

- [ ] **Step 1: Create the controller file**

```ts
// app/backend/onboarding/controller.server.ts
import supabase from "../../db/supabase.server";

export type OnboardingStatus = {
  gmailConnected: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

export async function getOnboardingStatus(shopId: string): Promise<OnboardingStatus> {
  const [gmailResult, supplierResult, reorderResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("shop_google_accounts")
      .select("shop_id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_disconnected", false),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("suppliers")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("is_active", true),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("reorder_rules")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId),
  ]);

  const gmailConnected = (gmailResult.count ?? 0) > 0;
  const supplierAdded = (supplierResult.count ?? 0) > 0;
  const reorderConfigured = (reorderResult.count ?? 0) > 0;

  return {
    gmailConnected,
    supplierAdded,
    reorderConfigured,
    allComplete: gmailConnected && supplierAdded && reorderConfigured,
  };
}
```

- [ ] **Step 2: Verify the `reorder_rules` table has a `shop_id` column**

Run:
```bash
grep -n "shop_id" app/backend/products/controller.server.ts | head -10
```

Expected: lines showing `.eq("shop_id", shopId)` on `reorder_rules` queries. If `reorder_rules` does NOT have `shop_id` directly (it may join through `products`), replace the reorder query with:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(supabase as any)
  .from("reorder_rules")
  .select("id, products!inner(shop_id)", { count: "exact", head: true })
  .eq("products.shop_id", shopId),
```

- [ ] **Step 3: Commit**

```bash
git add app/backend/onboarding/controller.server.ts
git commit -m "feat: add getOnboardingStatus controller"
```

---

### Task 2: Onboarding route loader

**Files:**
- Create: `app/backend/onboarding/views.tsx`
- Modify: `app/routes.ts`

- [ ] **Step 1: Create the views file**

```ts
// app/backend/onboarding/views.tsx
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../../shopify.server";
import { getShopByDomain } from "../shops/controller.server";
import { getOnboardingStatus } from "./controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const forceOnboarding = process.env.FORCE_ONBOARDING === "true";
  const status = await getOnboardingStatus(shop.id);

  if (status.allComplete && !forceOnboarding) {
    return redirect("/app");
  }

  return { status, shopId: shop.id };
};

export { default } from "../../frontend/pages/OnboardingPage";

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
```

- [ ] **Step 2: Register the route in `app/routes.ts`**

Add the onboarding route as a child of the `app` layout, before `products`:

```ts
// app/routes.ts  — inside the route("app", ...) children array, add:
route("onboarding", "backend/onboarding/views.tsx"),
```

Full updated routes array (children of `route("app", ...)`):
```ts
[
  index("backend/dashboard/views.tsx"),
  route("onboarding",              "backend/onboarding/views.tsx"),
  route("products",                "backend/products/views.tsx"),
  route("products/:id",            "backend/products/detail.views.tsx"),
  route("purchase-orders",         "backend/purchase-orders/views.tsx"),
  route("purchase-orders/new",     "backend/purchase-orders/new.views.tsx"),
  route("purchase-orders/:id",     "backend/purchase-orders/detail.views.tsx"),
  route("purchase-orders/:id/pdf", "backend/purchase-orders/pdf.views.tsx"),
  route("suppliers",               "backend/suppliers/views.tsx"),
  route("suppliers/new",           "backend/suppliers/new.views.tsx"),
  route("suppliers/:id",           "backend/suppliers/detail.views.tsx"),
  route("settings",                "backend/settings/views.tsx"),
  route("forecasts",               "backend/forecasts/views.tsx"),
]
```

- [ ] **Step 3: Commit**

```bash
git add app/backend/onboarding/views.tsx app/routes.ts
git commit -m "feat: add onboarding route and loader"
```

---

### Task 3: Redirect gate in app layout

**Files:**
- Modify: `app/frontend/app.tsx`

- [ ] **Step 1: Add `getOnboardingStatus` import and redirect logic to the loader**

In `app/frontend/app.tsx`, update the loader. The current loader is:

```ts
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await upsertShop(session);
  const notifications = await getUnreadNotifications(shop.id);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", notifications };
};
```

Replace with:

```ts
import { redirect } from "react-router";
import { getOnboardingStatus } from "../backend/onboarding/controller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await upsertShop(session);

  const url = new URL(request.url);
  const isOnboardingPage = url.pathname === "/app/onboarding";
  const forceOnboarding = process.env.FORCE_ONBOARDING === "true";

  const status = await getOnboardingStatus(shop.id);

  if ((forceOnboarding || !status.allComplete) && !isOnboardingPage) {
    return redirect("/app/onboarding");
  }

  const notifications = await getUnreadNotifications(shop.id);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", notifications };
};
```

Note: `redirect` is already imported from `react-router` at the top of the file — verify and add if missing.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. Fix any import path issues if they appear.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/app.tsx
git commit -m "feat: redirect to onboarding when setup incomplete"
```

---

### Task 4: Onboarding page UI

**Files:**
- Create: `app/frontend/pages/OnboardingPage.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/frontend/pages/OnboardingPage.tsx
import { useEffect } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import checklistSvg from "../assets/checklist.svg";

type OnboardingStatus = {
  gmailConnected: boolean;
  supplierAdded: boolean;
  reorderConfigured: boolean;
  allComplete: boolean;
};

type LoaderData = { status: OnboardingStatus; shopId: string };

export default function OnboardingPage() {
  const { status, shopId } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "gmail_connected") revalidate();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [revalidate]);

  const handleConnectGmail = () => {
    window.open(
      `${window.location.origin}/auth/google/start?shop_id=${shopId}`,
      "_blank",
    );
  };

  const steps = [
    {
      label: "Connect Gmail and allow access",
      complete: status.gmailConnected,
      cta: "Connect Gmail",
      onAction: handleConnectGmail,
    },
    {
      label: "Connect first supplier",
      complete: status.supplierAdded,
      cta: "Add Supplier",
      onAction: () => navigate("/app/suppliers/new"),
    },
    {
      label: "Configure a product (set reorder point)",
      complete: status.reorderConfigured,
      cta: "Set Reorder Point",
      onAction: () => navigate("/app/products"),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--s-color-bg-app, #F1F2F3)",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          border: "1px solid var(--s-color-border, #E1E3E5)",
          padding: "32px",
          maxWidth: "640px",
          width: "100%",
          display: "flex",
          gap: "32px",
          alignItems: "center",
        }}
      >
        {/* Left: steps */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              margin: "0 0 24px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--s-color-text, #202223)",
            }}
          >
            Get started with Brim
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <StepIndicator complete={step.complete} />
                <span
                  style={{
                    flex: 1,
                    fontSize: "14px",
                    color: step.complete
                      ? "var(--s-color-text-subdued, #6D7175)"
                      : "var(--s-color-text, #202223)",
                    textDecoration: step.complete ? "line-through" : "none",
                  }}
                >
                  {i + 1}. {step.label}
                </span>
                {!step.complete && (
                  <s-button size="slim" onClick={step.onAction}>
                    {step.cta}
                  </s-button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <s-button variant="primary" onClick={() => navigate("/app/suppliers/new")}>
              Connect Supplier
            </s-button>
            <s-link href="#">Quick Tour Video</s-link>
          </div>
        </div>

        {/* Right: graphic */}
        <div style={{ flexShrink: 0 }}>
          <img src={checklistSvg} alt="" style={{ width: "160px", height: "auto" }} />
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "#1A7A4C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "24px",
        height: "24px",
        borderRadius: "50%",
        border: "2px solid var(--s-color-border, #E1E3E5)",
        flexShrink: 0,
      }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/pages/OnboardingPage.tsx
git commit -m "feat: add OnboardingPage UI component"
```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test with `FORCE_ONBOARDING=true`**

Add to `.env`:
```
FORCE_ONBOARDING=true
```

Visit `/app` — should redirect to `/app/onboarding`. Verify:
- All 3 steps show their current real state (complete = green check, incomplete = empty circle)
- "Connect Gmail" opens a new tab to Google OAuth
- "Add Supplier" navigates to `/app/suppliers/new`
- "Set Reorder Point" navigates to `/app/products`
- Checklist SVG renders on the right

- [ ] **Step 3: Verify existing users are unaffected**

Remove `FORCE_ONBOARDING=true` from `.env`. Visit `/app` — if your shop already has Gmail connected, a supplier, and a reorder rule, you should land on the dashboard with no redirect.

- [ ] **Step 4: Test Gmail postMessage revalidation**

With `FORCE_ONBOARDING=true` and Gmail NOT connected, click "Connect Gmail". Complete the OAuth flow in the new tab. The tab should close and step 1 should update to complete without a page refresh.

- [ ] **Step 5: Final commit**

```bash
git add .env.example  # if you have one, add FORCE_ONBOARDING= placeholder
git commit -m "feat: complete onboarding flow"
```
