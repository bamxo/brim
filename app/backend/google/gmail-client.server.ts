import { google, type gmail_v1 } from "googleapis";
import {
  createOAuthClient,
  decryptAccountTokens,
  getGoogleAccount,
  markDisconnected,
  updateAccessToken,
} from "./oauth.server";

export class GmailNotConnectedError extends Error {
  constructor(message = "Gmail account not connected") {
    super(message);
    this.name = "GmailNotConnectedError";
  }
}

export async function getGmailClient(shopId: string): Promise<gmail_v1.Gmail> {
  const account = await getGoogleAccount(shopId);
  if (!account || account.is_disconnected) {
    throw new GmailNotConnectedError();
  }

  const { accessToken, refreshToken } = decryptAccountTokens(account);
  const client = createOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: new Date(account.token_expires_at).getTime(),
  });

  client.on("tokens", (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      void updateAccessToken(
        shopId,
        tokens.access_token,
        new Date(tokens.expiry_date),
      );
    }
  });

  try {
    const expiresAt = new Date(account.token_expires_at).getTime();
    if (expiresAt - Date.now() < 60_000) {
      const { credentials } = await client.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await updateAccessToken(
          shopId,
          credentials.access_token,
          new Date(credentials.expiry_date),
        );
      }
    }
  } catch (err) {
    await markDisconnected(shopId);
    throw new GmailNotConnectedError(
      `Failed to refresh Gmail token: ${(err as Error).message}`,
    );
  }

  return google.gmail({ version: "v1", auth: client });
}
