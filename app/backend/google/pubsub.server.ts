import { getGmailClient } from "./gmail-client.server";
import {
  getGoogleAccount,
  updateHistoryId,
  updateWatchExpiry,
} from "./oauth.server";

const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC_NAME;

export async function startWatch(shopId: string): Promise<void> {
  if (!PUBSUB_TOPIC) throw new Error("PUBSUB_TOPIC_NAME is not set");
  const gmail = await getGmailClient(shopId);
  const { data } = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: PUBSUB_TOPIC,
      labelIds: ["INBOX"],
      labelFilterAction: "include",
    },
  });
  if (data.historyId) await updateHistoryId(shopId, data.historyId);
  if (data.expiration) {
    await updateWatchExpiry(shopId, new Date(Number(data.expiration)));
  }
}

export async function stopWatch(shopId: string): Promise<void> {
  const gmail = await getGmailClient(shopId);
  await gmail.users.stop({ userId: "me" });
}

export async function ensureWatch(shopId: string): Promise<void> {
  const account = await getGoogleAccount(shopId);
  if (!account || account.is_disconnected) return;
  const expiresAt = account.watch_expires_at ? new Date(account.watch_expires_at) : null;
  const oneDay = 24 * 60 * 60 * 1000;
  if (!expiresAt || expiresAt.getTime() - Date.now() < oneDay) {
    try {
      await startWatch(shopId);
    } catch (err) {
      console.error("Failed to start Gmail watch:", err);
    }
  }
}
