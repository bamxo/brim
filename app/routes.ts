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
    route("products/:id",         "backend/products/detail.views.tsx"),
    route("purchase-orders",      "backend/purchase-orders/views.tsx"),
    route("purchase-orders/new",  "backend/purchase-orders/new.views.tsx"),
    route("purchase-orders/:id",  "backend/purchase-orders/detail.views.tsx"),
    route("purchase-orders/:id/pdf", "backend/purchase-orders/pdf.views.tsx"),
    route("suppliers",            "backend/suppliers/views.tsx"),
    route("suppliers/new",        "backend/suppliers/new.views.tsx"),
    route("suppliers/:id",        "backend/suppliers/detail.views.tsx"),
    route("settings",             "backend/settings/views.tsx"),
  ]),

  // ── Extension resource routes (no layout, CORS-enabled) ───────────────
  route("api/ext/products/:id/reorder-rule", "backend/products/ext-reorder-rule.server.ts"),
  route("api/ext/products/:id/suppliers",    "backend/products/ext-suppliers.server.ts"),

  // ── Webhooks (server-only, no layout) ──────────────────────────────────
  route("webhooks/app/uninstalled",          "backend/webhooks/app-uninstalled.ts"),
  route("webhooks/app/scopes_update",        "backend/webhooks/app-scopes-update.ts"),
  route("webhooks/inventory-levels/update",  "backend/webhooks/inventory-levels.ts"),
  route("webhooks/products/create",          "backend/webhooks/products-create.ts"),
  route("webhooks/products/delete",          "backend/webhooks/products-delete.ts"),
  route("webhooks/products/update",          "backend/webhooks/products-update.ts"),
  route("webhooks/gmail",                    "backend/webhooks/gmail.ts"),

  // ── Google OAuth (Gmail integration) ───────────────────────────────────
  route("auth/google/start",      "routes/auth.google.start/route.tsx"),
  route("auth/google/callback",   "routes/auth.google.callback/route.tsx"),
  route("auth/google/disconnect", "routes/auth.google.disconnect/route.tsx"),

  // ── Auth (Shopify OAuth — keep as-is) ──────────────────────────────────
  route("auth/login", "routes/auth.login/route.tsx"),
  route("auth/*",     "routes/auth.$.tsx"),

  // ── Public landing page ─────────────────────────────────────────────────
  index("routes/_index/route.tsx"),
] satisfies RouteConfig;
