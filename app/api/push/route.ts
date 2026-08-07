import { getD1 } from "@/db/d1";
import {
  isPushSubscription,
  pushConfiguration,
  sendPush,
  type StoredPushSubscription,
} from "@/app/lib/push";

export const dynamic = "force-dynamic";

type SubscriptionRow = {
  endpoint: string;
  subscription_json: string;
};

function ownerId(request: Request) {
  return request.headers.get("oai-authenticated-user-id")?.trim() || null;
}

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function subscriptionsForOwner(owner: string) {
  const result = await (await getD1())
    .prepare(
      `SELECT endpoint, subscription_json
       FROM push_subscriptions
       WHERE owner_id = ?`,
    )
    .bind(owner)
    .all<SubscriptionRow>();
  return result.results;
}

export async function GET(request: Request) {
  const owner = ownerId(request);
  if (!owner) return json({ error: "Authentication required" }, 401);

  const configuration = pushConfiguration();
  try {
    const subscription = await (await getD1())
      .prepare(
        `SELECT endpoint
         FROM push_subscriptions
         WHERE owner_id = ?
         LIMIT 1`,
      )
      .bind(owner)
      .first<{ endpoint: string }>();

    return json({
      configured: configuration.configured,
      publicKey: configuration.configured ? configuration.publicKey : null,
      subscribed: Boolean(subscription),
    });
  } catch {
    return json({ error: "Push subscriptions are temporarily unavailable" }, 503);
  }
}

export async function PUT(request: Request) {
  const owner = ownerId(request);
  if (!owner) return json({ error: "Authentication required" }, 401);
  if (!pushConfiguration().configured) {
    return json({ error: "Web Push is not configured" }, 503);
  }

  let subscription: unknown;
  try {
    subscription = await request.json();
  } catch {
    return json({ error: "Invalid push subscription" }, 400);
  }
  if (!isPushSubscription(subscription)) {
    return json({ error: "Invalid push subscription" }, 400);
  }

  try {
    await (await getD1())
      .prepare(
        `INSERT INTO push_subscriptions
           (owner_id, endpoint, subscription_json, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(owner_id, endpoint) DO UPDATE SET
           subscription_json = excluded.subscription_json,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(owner, subscription.endpoint, JSON.stringify(subscription))
      .run();
    return json({ subscribed: true });
  } catch {
    return json({ error: "Push subscription could not be saved" }, 503);
  }
}

export async function DELETE(request: Request) {
  const owner = ownerId(request);
  if (!owner) return json({ error: "Authentication required" }, 401);
  try {
    await (await getD1())
      .prepare("DELETE FROM push_subscriptions WHERE owner_id = ?")
      .bind(owner)
      .run();
    return json({ subscribed: false });
  } catch {
    return json({ error: "Push subscription could not be removed" }, 503);
  }
}

export async function POST(request: Request) {
  const owner = ownerId(request);
  if (!owner) return json({ error: "Authentication required" }, 401);
  if (!pushConfiguration().configured) {
    return json({ error: "Web Push is not configured" }, 503);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { body?: unknown };
    const notificationBody =
      typeof body.body === "string" && body.body.trim()
        ? body.body.trim().slice(0, 300)
        : "The connection works. Your Mini CEO can reach this device after the app closes.";
    const subscriptions = await subscriptionsForOwner(owner);
    let sent = 0;

    for (const row of subscriptions) {
      let subscription: StoredPushSubscription;
      try {
        subscription = JSON.parse(row.subscription_json) as StoredPushSubscription;
      } catch {
        continue;
      }
      const result = await sendPush(subscription, {
        title: "Mini CEO is on duty",
        body: notificationBody,
        tag: "mini-ceo-test",
        url: "/",
        badgeCount: 1,
      });
      if (result.sent) sent += 1;
      if (result.expired) {
        await (await getD1())
          .prepare(
            "DELETE FROM push_subscriptions WHERE owner_id = ? AND endpoint = ?",
          )
          .bind(owner, row.endpoint)
          .run();
      }
    }

    if (!sent) return json({ error: "No active push subscription" }, 409);
    return json({ sent });
  } catch {
    return json({ error: "Test push could not be delivered" }, 502);
  }
}
