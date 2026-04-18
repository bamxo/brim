import { OAuth2Client } from "google-auth-library";
import supabase from "../../db/supabase.server";
import { decryptToken, encryptToken } from "./crypto.server";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function createOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth env vars are not set");
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function buildAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Missing tokens from Google OAuth response");
  }
  client.setCredentials(tokens);

  const userinfo = await client.request<{ email: string }>({
    url: "https://www.googleapis.com/oauth2/v2/userinfo",
  });
  const email = userinfo.data.email;
  if (!email) throw new Error("Google did not return an email address");

  return {
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date),
  };
}

export type ShopGoogleAccount = {
  shop_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  gmail_history_id: string | null;
  watch_expires_at: string | null;
  is_disconnected: boolean;
  connected_at: string;
  updated_at: string;
};

export async function saveGoogleAccount(
  shopId: string,
  params: {
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("shop_google_accounts").upsert(
    {
      shop_id: shopId,
      google_email: params.email,
      access_token: encryptToken(params.accessToken),
      refresh_token: encryptToken(params.refreshToken),
      token_expires_at: params.expiresAt.toISOString(),
      is_disconnected: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_id" },
  );
  if (error) throw new Error(`Failed to save google account: ${error.message}`);
}

export async function getGoogleAccount(
  shopId: string,
): Promise<ShopGoogleAccount | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("shop_google_accounts")
    .select("*")
    .eq("shop_id", shopId)
    .single();
  return (data as ShopGoogleAccount) ?? null;
}

export async function getGoogleAccountByEmail(
  email: string,
): Promise<ShopGoogleAccount | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("shop_google_accounts")
    .select("*")
    .eq("google_email", email)
    .single();
  return (data as ShopGoogleAccount) ?? null;
}

export async function deleteGoogleAccount(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("shop_google_accounts")
    .delete()
    .eq("shop_id", shopId);
  if (error) throw new Error(`Failed to delete google account: ${error.message}`);
}

export async function markDisconnected(shopId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("shop_google_accounts")
    .update({ is_disconnected: true, updated_at: new Date().toISOString() })
    .eq("shop_id", shopId);
}

export async function updateAccessToken(
  shopId: string,
  accessToken: string,
  expiresAt: Date,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("shop_google_accounts")
    .update({
      access_token: encryptToken(accessToken),
      token_expires_at: expiresAt.toISOString(),
      is_disconnected: false,
      updated_at: new Date().toISOString(),
    })
    .eq("shop_id", shopId);
}

export async function updateHistoryId(shopId: string, historyId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("shop_google_accounts")
    .update({ gmail_history_id: historyId, updated_at: new Date().toISOString() })
    .eq("shop_id", shopId);
}

export async function updateWatchExpiry(shopId: string, expiresAt: Date) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("shop_google_accounts")
    .update({
      watch_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("shop_id", shopId);
}

export function decryptAccountTokens(account: ShopGoogleAccount): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: decryptToken(account.access_token),
    refreshToken: decryptToken(account.refresh_token),
  };
}
