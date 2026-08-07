import { getD1 } from "@/db/d1";
import type { MiniCeoState } from "@/app/lib/mini-ceo";

export const dynamic = "force-dynamic";

const SYNC_PAYLOAD_VERSION = 1;
const MAX_BODY_BYTES = 1024 * 1024;

type AuthenticatedUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type WorkspaceRow = {
  state_json: string;
  state_version: number;
  updated_at: string;
};

type SyncPayload = {
  version: number;
  state: MiniCeoState;
};

function jsonError(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function readAuthenticatedUser(request: Request): AuthenticatedUser | null {
  const id = request.headers.get("oai-authenticated-user-id")?.trim();
  if (!id) return null;

  const email = request.headers.get("oai-authenticated-user-email")?.trim() || null;
  const encodedName = request.headers
    .get("oai-authenticated-user-full-name")
    ?.trim();
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding",
  );
  let name: string | null = null;

  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      name = decodeURIComponent(encodedName).trim() || null;
    } catch {
      name = null;
    }
  }

  return { id, email, name };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => typeof value[field] === "string");
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function isReference(value: unknown) {
  return (
    isRecord(value) &&
    hasStrings(value, ["id", "label", "sourceValue", "createdAt"]) &&
    ["link", "video", "script"].includes(String(value.sourceType))
  );
}

function isContentSkill(value: unknown) {
  return (
    isRecord(value) &&
    hasStrings(value, [
      "id",
      "name",
      "hook",
      "pacing",
      "tone",
      "visualFormat",
      "length",
    ]) &&
    isFiniteNumber(value.examples) &&
    isFiniteNumber(value.confidence)
  );
}

function isIdeaProvenance(value: unknown) {
  return (
    isRecord(value) &&
    ["ai-original", "creator-input"].includes(String(value.kind)) &&
    hasStrings(value, ["label", "detail"])
  );
}

function isIdea(value: unknown) {
  return (
    isRecord(value) &&
    hasStrings(value, ["id", "title", "hook", "angle", "topic"]) &&
    (value.goalFit === undefined || isFiniteNumber(value.goalFit)) &&
    (value.fitReason === undefined || typeof value.fitReason === "string") &&
    (value.verificationNote === undefined || typeof value.verificationNote === "string") &&
    (value.provenance === undefined || isIdeaProvenance(value.provenance)) &&
    ["boss", "creator"].includes(String(value.source)) &&
    ["suggested", "approved", "rejected"].includes(String(value.status)) &&
    (value.skillId === undefined || typeof value.skillId === "string")
  );
}

function isEvidence(value: unknown) {
  return (
    isRecord(value) &&
    ["done", "file", "link"].includes(String(value.type)) &&
    hasStrings(value, ["value", "createdAt"])
  );
}

function isCreatorTask(value: unknown) {
  return (
    isRecord(value) &&
    hasStrings(value, [
      "id",
      "ideaId",
      "title",
      "brief",
      "day",
      "scheduledDate",
      "dueAt",
      "weekStartDate",
      "time",
    ]) &&
    ["idea", "research", "script", "production", "shoot", "edit", "publish"].includes(
      String(value.stage),
    ) &&
    ["queued", "active", "done", "skipped"].includes(String(value.status)) &&
    isFiniteNumber(value.duration) &&
    (value.evidence === undefined || isEvidence(value.evidence))
  );
}

function isAchievement(value: unknown) {
  return (
    isRecord(value) && hasStrings(value, ["id", "title", "detail", "unlockedAt"])
  );
}

function isMiniCeoState(value: unknown): value is MiniCeoState {
  if (!isRecord(value) || !Number.isInteger(value.version)) return false;
  if (typeof value.onboardingComplete !== "boolean" || !isRecord(value.profile)) {
    return false;
  }

  const profile = value.profile;
  if (
    typeof profile.name !== "string" ||
    typeof profile.goal !== "string" ||
    !Array.isArray(profile.platforms) ||
    !profile.platforms.every((entry) => typeof entry === "string") ||
    !Number.isInteger(profile.videosPerWeek) ||
    !Array.isArray(profile.topics) ||
    !profile.topics.every((entry) => typeof entry === "string") ||
    !Array.isArray(profile.workDays) ||
    !profile.workDays.every((entry) => typeof entry === "string") ||
    !["daily", "batch"].includes(String(profile.scheduleStyle)) ||
    !["coach", "serious", "unhinged"].includes(String(profile.bossMode)) ||
    !isRecord(profile.quietHours) ||
    !hasStrings(profile.quietHours, ["start", "end"])
  ) {
    return false;
  }

  return (
    Array.isArray(value.references) && value.references.every(isReference) &&
    Array.isArray(value.skills) && value.skills.every(isContentSkill) &&
    Array.isArray(value.ideas) && value.ideas.every(isIdea) &&
    Array.isArray(value.tasks) && value.tasks.every(isCreatorTask) &&
    Array.isArray(value.achievements) && value.achievements.every(isAchievement) &&
    Array.isArray(value.activityDates) &&
    value.activityDates.every((entry) => typeof entry === "string") &&
    isFiniteNumber(value.streak) &&
    isFiniteNumber(value.weeklyScore) &&
    isFiniteNumber(value.bossApproval) &&
    isFiniteNumber(value.publishedThisWeek) &&
    typeof value.lastActiveDate === "string" &&
    typeof value.weekStartDate === "string"
  );
}

async function parsePayload(request: Request): Promise<SyncPayload | Response> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError("Workspace payload is too large", 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonError("Workspace payload is too large", 413);
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  if (!isRecord(value) || value.version !== SYNC_PAYLOAD_VERSION) {
    return jsonError(
      `Unsupported workspace payload version; expected ${SYNC_PAYLOAD_VERSION}`,
      400,
    );
  }
  if (!isMiniCeoState(value.state)) {
    return jsonError("Invalid Mini CEO workspace state", 400);
  }

  return { version: SYNC_PAYLOAD_VERSION, state: value.state };
}

export async function GET(request: Request) {
  const user = readAuthenticatedUser(request);
  if (!user) return jsonError("Authentication required", 401);

  try {
    const row = await (await getD1())
      .prepare(
        `SELECT state_json, state_version, updated_at
         FROM creator_workspaces
         WHERE owner_id = ?`,
      )
      .bind(user.id)
      .first<WorkspaceRow>();

    if (!row) {
      return jsonResponse({
        state: null,
        version: SYNC_PAYLOAD_VERSION,
        updatedAt: null,
        user: { email: user.email, name: user.name },
      });
    }

    let state: unknown;
    try {
      state = JSON.parse(row.state_json);
    } catch {
      return jsonError("Saved workspace is unreadable", 500);
    }

    return jsonResponse({
      state,
      version: row.state_version,
      updatedAt: row.updated_at,
      user: { email: user.email, name: user.name },
    });
  } catch {
    return jsonError("Cloud workspace is temporarily unavailable", 503);
  }
}

export async function PUT(request: Request) {
  const user = readAuthenticatedUser(request);
  if (!user) return jsonError("Authentication required", 401);

  const payload = await parsePayload(request);
  if (payload instanceof Response) return payload;

  try {
    await (await getD1())
      .prepare(
        `INSERT INTO creator_workspaces
           (owner_id, state_json, state_version, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(owner_id) DO UPDATE SET
           state_json = excluded.state_json,
           state_version = excluded.state_version,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(user.id, JSON.stringify(payload.state), payload.version)
      .run();

    return jsonResponse({
      saved: true,
      version: payload.version,
      user: { email: user.email, name: user.name },
    });
  } catch {
    return jsonError("Cloud workspace could not be saved", 503);
  }
}

export async function DELETE(request: Request) {
  const user = readAuthenticatedUser(request);
  if (!user) return jsonError("Authentication required", 401);

  try {
    await (await getD1())
      .prepare("DELETE FROM creator_workspaces WHERE owner_id = ?")
      .bind(user.id)
      .run();
    return jsonResponse({ deleted: true });
  } catch {
    return jsonError("Cloud workspace could not be deleted", 503);
  }
}
