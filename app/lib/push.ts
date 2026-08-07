import webpush from "web-push";

export type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url?: string;
  badgeCount?: number;
};

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    "https://mini-ceo-creator.ble77.chatgpt.site";
  return {
    configured: Boolean(publicKey && privateKey && subject),
    publicKey,
    privateKey,
    subject,
  };
}

export function isPushSubscription(value: unknown): value is StoredPushSubscription {
  if (!value || typeof value !== "object") return false;
  const subscription = value as Partial<StoredPushSubscription>;
  return Boolean(
    typeof subscription.endpoint === "string" &&
      subscription.endpoint.startsWith("https://") &&
      subscription.endpoint.length <= 2_048 &&
      subscription.keys &&
      typeof subscription.keys.p256dh === "string" &&
      subscription.keys.p256dh.length <= 512 &&
      typeof subscription.keys.auth === "string" &&
      subscription.keys.auth.length <= 512,
  );
}

export async function sendPush(
  subscription: StoredPushSubscription,
  payload: PushPayload,
) {
  const configuration = pushConfiguration();
  if (!configuration.configured) {
    throw new Error("Web Push is not configured");
  }

  webpush.setVapidDetails(
    configuration.subject,
    configuration.publicKey,
    configuration.privateKey,
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60,
      urgency: "high",
    });
    return { sent: true, expired: false };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
    if (statusCode === 404 || statusCode === 410) {
      return { sent: false, expired: true };
    }
    throw new Error("Push delivery failed");
  }
}
