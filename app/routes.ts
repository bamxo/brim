import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  // ── Authenticated app (layout wraps all /app/* pages) ──────────────────
  route("app", "frontend/app.tsx", [
    index("backend/dashboard/views.tsx"),
    route("products",             "backend/products/views.tsx"),
    route("products/sync",        "backend/products/sync.views.tsx"),
    route("products/:id",         "backend/products/detail.views.tsx"),
    route("purchase-orders",      "backend/purchase-orders/views.tsx"),
    route("purchase-orders/:id",  "backend/purchase-orders/detail.views.tsx"),
    route("suppliers",            "backend/suppliers/views.tsx"),
    route("suppliers/new",        "backend/suppliers/new.views.tsx"),
    route("suppliers/:id",        "backend/suppliers/detail.views.tsx"),
    route("settings",             "backend/settings/views.tsx"),
  ]),

  // ── Webhooks (server-only, no layout) ──────────────────────────────────
  route("webhooks/app/uninstalled",          "backend/webhooks/app-uninstalled.ts"),
  route("webhooks/app/scopes_update",        "backend/webhooks/app-scopes-update.ts"),
  route("webhooks/inventory-levels/update",  "backend/webhooks/inventory-levels.ts"),
  route("webhooks/products/create",          "backend/webhooks/products-create.ts"),
  route("webhooks/products/delete",          "backend/webhooks/products-delete.ts"),
  route("webhooks/inbound-email",            "backend/webhooks/inbound-email.ts"),

  // ── Auth (Shopify OAuth — keep as-is) ──────────────────────────────────
  route("auth/login", "routes/auth.login/route.tsx"),
  route("auth/*",     "routes/auth.$.tsx"),

  // ── Public landing page ─────────────────────────────────────────────────
  index("routes/_index/route.tsx"),
] satisfies RouteConfig;
