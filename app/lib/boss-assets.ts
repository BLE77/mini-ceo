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
} as const satisfies Record<string, BossExpression>;

export type BossMood = keyof typeof BOSS_MOOD_EXPRESSION;
