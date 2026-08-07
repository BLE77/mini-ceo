const BOSS_ASSET_ROOT = "/characters/mini-ceo";

export const BOSS_EXPRESSION_ASSETS = {
  focused: `${BOSS_ASSET_ROOT}/expressions/focused.png`,
  approving: `${BOSS_ASSET_ROOT}/expressions/approving.png`,
  thinking: `${BOSS_ASSET_ROOT}/expressions/thinking.png`,
  celebrating: `${BOSS_ASSET_ROOT}/expressions/celebrating.png`,
  concerned: `${BOSS_ASSET_ROOT}/expressions/concerned.png`,
  disappointed: `${BOSS_ASSET_ROOT}/expressions/disappointed.png`,
  impatient: `${BOSS_ASSET_ROOT}/expressions/impatient.png`,
  surprised: `${BOSS_ASSET_ROOT}/expressions/surprised.png`,
} as const;

export const BOSS_ACTION_ASSETS = {
  welcome: `${BOSS_ASSET_ROOT}/actions/welcome.png`,
  assignment: `${BOSS_ASSET_ROOT}/actions/assignment.png`,
  working: `${BOSS_ASSET_ROOT}/actions/working.png`,
  reminder: `${BOSS_ASSET_ROOT}/actions/reminder.png`,
  complete: `${BOSS_ASSET_ROOT}/actions/complete.png`,
  missedDeadline: `${BOSS_ASSET_ROOT}/actions/missed-deadline.png`,
} as const;

export const BOSS_ATLAS_ASSETS = {
  expressions: `${BOSS_ASSET_ROOT}/expressions-atlas.png`,
  actions: `${BOSS_ASSET_ROOT}/actions-atlas.png`,
} as const;

export type BossExpression = keyof typeof BOSS_EXPRESSION_ASSETS;
export type BossAction = keyof typeof BOSS_ACTION_ASSETS;

export const BOSS_MOOD_EXPRESSION = {
  focused: "focused",
  pleased: "approving",
  impatient: "impatient",
  talking: "surprised",
  approving: "approving",
  thinking: "thinking",
  celebrating: "celebrating",
  concerned: "concerned",
  disappointed: "disappointed",
  surprised: "surprised",
} as const satisfies Record<string, BossExpression>;

export type BossMood = keyof typeof BOSS_MOOD_EXPRESSION;

export type BossConversationPhase =
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "idle"
  | "error";

type BossConversationMode = "coach" | "serious" | "unhinged";

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Reads the real agent response and chooses the matching eye-led portrait.
 * The text stays fully model-generated; this only controls presentation.
 */
export function inferBossExpression(
  message: string | undefined,
  mode: BossConversationMode,
): BossExpression {
  const text = message?.trim() ?? "";
  if (!text) {
    return mode === "coach" ? "approving" : mode === "unhinged" ? "impatient" : "focused";
  }

  const normalized = text.toLowerCase();
  const angry = matchesAny(normalized, [
    /\blazy\b/,
    /\bslacking\b/,
    /\bno more excuses?\b/,
    /\bget (?:your|that) ass\b/,
    /\bunacceptable\b/,
    /\bfuri(?:ous|ated)\b/,
    /\bfor fuck'?s sake\b/,
    /\bwhat the (?:hell|fuck)\b/,
    /\b(?:damn|fucking) (?:video|task|thing|deadline)\b/,
  ]);
  const urgent = matchesAny(normalized, [
    /\bright now\b/,
    /\bimmediately\b/,
    /\bdeadline\b/,
    /\boverdue\b/,
    /\bbehind schedule\b/,
    /\bthree (?:missed )?days\b/,
    /\b3 (?:missed )?days\b/,
    /\bwhat are you waiting for\b/,
    /\bmove it\b/,
  ]);
  const disappointed = matchesAny(normalized, [
    /\bdisappointed\b/,
    /\blet (?:me|the team|yourself) down\b/,
    /\bmissed (?:it|the task|the deadline|work)\b/,
    /\b(?:didn't|did not|haven't|have not) (?:post|publish|finish|ship|do)\b/,
    /\bskipped (?:it|the task|work)\b/,
    /\bfailed to\b/,
    /\bstill not (?:done|finished|published|live)\b/,
  ]);
  const concerned = matchesAny(normalized, [
    /\bblocked\b/,
    /\bproblem\b/,
    /\brisk(?:y)?\b/,
    /\bcareful\b/,
    /\bverify\b/,
    /\bneeds? proof\b/,
    /\bunavailable\b/,
    /\bcan't continue\b/,
    /\bcannot continue\b/,
  ]);
  const celebrating = matchesAny(normalized, [
    /\byou (?:did it|shipped it|nailed it)\b/,
    /\bwe (?:did it|shipped it|are live)\b/,
    /\b(?:the|it'?s|video is) (?:published|shipped|live)\b/,
    /\bhell yes\b/,
    /\blet'?s go[!.]?\b/,
    /\bproud of you\b/,
  ]);
  const approving = matchesAny(normalized, [
    /\bgood (?:call|move|work|job|choice)\b/,
    /\bgreat (?:call|move|work|job|choice)\b/,
    /\bexactly\b/,
    /\bapproved\b/,
    /\bthat'?s (?:it|right|the move)\b/,
    /\bsmart (?:call|move|choice)\b/,
  ]);
  const surprised = matchesAny(normalized, [
    /\bno way\b/,
    /\bseriously[?!]/,
    /\bwait[,.!?]/,
    /\bi (?:can'?t|cannot) believe\b/,
    /\bwhat just happened\b/,
  ]);
  const thinking = matchesAny(normalized, [
    /\blet'?s (?:think|figure|work through|break this down)\b/,
    /\bconsider (?:this|these|the)\b/,
    /\b(?:two|three|four) options?\b/,
    /\bthe plan is\b/,
    /\bfirst,? .+ then\b/,
  ]);

  if (angry) return "focused";
  if (celebrating && !urgent && !disappointed) return "celebrating";
  if (urgent) return "impatient";
  if (disappointed) return "disappointed";
  if (concerned) return "concerned";
  if (approving) return "approving";
  if (surprised) return "surprised";
  if (thinking) return "thinking";

  return mode === "coach" ? "approving" : mode === "unhinged" ? "impatient" : "focused";
}

export function resolveConversationBossExpression({
  message,
  mode,
  phase,
}: {
  message?: string;
  mode: BossConversationMode;
  phase: BossConversationPhase;
}): BossExpression {
  if (phase === "error") return "concerned";
  if (phase === "connecting" || phase === "thinking") return "thinking";
  if (phase === "listening") return "focused";
  return inferBossExpression(message, mode);
}
