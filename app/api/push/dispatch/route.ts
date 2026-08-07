import { getD1 } from "@/db/d1";
import { getAccountabilityReminder, type MiniCeoState } from "@/app/lib/mini-ceo";
import { sendPush, type StoredPushSubscription } from "@/app/lib/push";

export const dynamic = "force-dynamic";

type DispatchRow = {
  owner_id: string;
  endpoint: string;
  subscription_json: string;
  last_sent_key: string | null;
  state_json: string;
};

function authorized(request: Request) {
  const configured = process.env.PUSH_DISPATCH_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(configured && supplied && configured === supplied);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const rows = await (await getD1())
      .prepare(
        `SELECT p.owner_id, p.endpoint, p.subscription_json, p.last_sent_key,
                w.state_json
         FROM push_subscriptions p
         INNER JOIN creator_workspaces w ON w.owner_id = p.owner_id`,
      )
      .all<DispatchRow>();

    let sent = 0;
    let skipped = 0;
    let expired = 0;
    const now = new Date();

    for (const row of rows.results) {
      let state: MiniCeoState;
      let subscription: StoredPushSubscription;
      try {
        state = JSON.parse(row.state_json) as MiniCeoState;
        subscription = JSON.parse(row.subscription_json) as StoredPushSubscription;
      } catch {
        skipped += 1;
        continue;
      }

      const task =
        state.tasks.find((candidate) => candidate.status === "active") ||
        state.tasks
          .filter((candidate) => candidate.status === "queued")
          .sort(
            (left, right) =>
              new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
          )[0];
      const reminder = getAccountabilityReminder(state.profile, task, now);
      if (!reminder || reminder.quiet || reminder.key === row.last_sent_key) {
        skipped += 1;
        continue;
      }

      const result = await sendPush(subscription, {
        title: reminder.label,
        body: reminder.message,
        tag: `mini-ceo-${task?.id || "assignment"}`,
        url: "/",
        badgeCount: 1,
      });
      if (result.expired) {
        expired += 1;
        await (await getD1())
          .prepare(
            "DELETE FROM push_subscriptions WHERE owner_id = ? AND endpoint = ?",
          )
          .bind(row.owner_id, row.endpoint)
          .run();
        continue;
      }
      if (result.sent) {
        sent += 1;
        await (await getD1())
          .prepare(
            `UPDATE push_subscriptions
             SET last_sent_key = ?, updated_at = CURRENT_TIMESTAMP
             WHERE owner_id = ? AND endpoint = ?`,
          )
          .bind(reminder.key, row.owner_id, row.endpoint)
          .run();
      }
    }

    return Response.json(
      { checked: rows.results.length, sent, skipped, expired },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Push dispatch failed" }, { status: 503 });
  }
}
