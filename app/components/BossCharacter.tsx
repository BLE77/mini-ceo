"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import {
  BOSS_ACTION_ASSETS,
  BOSS_EXPRESSION_ASSETS,
  BOSS_MOOD_EXPRESSION,
  type BossAction,
  type BossExpression,
  type BossMood,
} from "../lib/boss-assets";
import type { BossMode } from "../lib/mini-ceo";

interface BossCharacterProps {
  mode: BossMode;
  mood?: BossMood;
  expression?: BossExpression;
  action?: BossAction;
  speaking?: boolean;
  compact?: boolean;
}

const ACTION_LABELS: Record<BossAction, string> = {
  welcome: "welcoming you to the team",
  assignment: "presenting today’s assignment",
  working: "working on the plan",
  reminder: "checking the deadline",
  complete: "celebrating completed work",
  missedDeadline: "following up on a missed deadline",
};

const EXPRESSION_LABELS: Record<BossExpression, string> = {
  focused: "focused",
  approving: "approving",
  thinking: "thinking",
  celebrating: "celebrating",
  concerned: "concerned",
  disappointed: "disappointed",
  impatient: "impatient",
  surprised: "surprised",
};

export function BossCharacter({
  mode,
  mood = "focused",
  expression,
  action,
  speaking = false,
  compact = false,
}: BossCharacterProps) {
  const reduceMotion = useReducedMotion();
  const resolvedExpression = expression ?? BOSS_MOOD_EXPRESSION[mood];
  const assetSrc = action
    ? BOSS_ACTION_ASSETS[action]
    : BOSS_EXPRESSION_ASSETS[resolvedExpression];
  const assetKey = action ? `action:${action}` : `expression:${resolvedExpression}`;
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const assetFailed = failedAsset === assetKey;
  const characterLabel = action
    ? `Mini CEO ${ACTION_LABELS[action]}`
    : `Mini CEO looking ${EXPRESSION_LABELS[resolvedExpression]}`;
  const energeticExpression =
    resolvedExpression === "focused" ||
    resolvedExpression === "impatient" ||
    resolvedExpression === "celebrating" ||
    resolvedExpression === "surprised";
  const expressionMotion =
    resolvedExpression === "celebrating"
      ? { y: [0, -8, 0], rotate: [0, -1, 1, 0] }
      : resolvedExpression === "concerned" || resolvedExpression === "disappointed"
        ? { y: [0, 2, 0], rotate: [0, -0.25, 0] }
        : resolvedExpression === "thinking"
          ? { y: [0, -3, 0], rotate: [0, 0.45, 0] }
          : energeticExpression
            ? { y: [0, -4, 0], rotate: [0, -0.8, 0.8, 0] }
            : { y: [0, -4, 0], rotate: [0, 0.35, 0] };

  return (
    <div
      className={`boss-character has-asset boss-${mode} mood-${mood} asset-${action ?? resolvedExpression} ${assetFailed ? "boss-asset-failed" : ""} ${speaking ? "is-speaking" : ""} ${compact ? "boss-compact" : ""}`}
      aria-label={characterLabel}
      data-expression={resolvedExpression}
      role="img"
    >
      <motion.div
        className="boss-character-motion"
        animate={
          reduceMotion
            ? undefined
            : expressionMotion
        }
        transition={{
          duration: energeticExpression ? 1.8 : 4.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <AnimatePresence initial={false} mode="sync">
          {!assetFailed && (
            <motion.div
              key={assetKey}
              className="boss-character-art-frame"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.965 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 1.025 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image
                className="boss-character-art"
                src={assetSrc}
                alt=""
                aria-hidden="true"
                width={512}
                height={512}
                draggable={false}
                priority={!compact}
                unoptimized
                onError={() => setFailedAsset(assetKey)}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {assetFailed && (
          <div className="boss-character-fallback" aria-hidden="true">
            <div className="boss-shadow" />
            <div className="boss-body">
              <div className="boss-lapel boss-lapel-left" />
              <div className="boss-lapel boss-lapel-right" />
              <div className="boss-shirt" />
              <div className="boss-tie">
                <span />
              </div>
              <div className="boss-pin">MC</div>
            </div>
            <div className="boss-neck" />
            <div className="boss-head">
              <div className="boss-hair">
                <i />
                <i />
                <i />
              </div>
              <div className="boss-ear boss-ear-left" />
              <div className="boss-ear boss-ear-right" />
              <div className="boss-brow boss-brow-left" />
              <div className="boss-brow boss-brow-right" />
              <div className="boss-eye boss-eye-left"><span /></div>
              <div className="boss-eye boss-eye-right"><span /></div>
              <div className="boss-shades" aria-hidden="true"><i /><i /><span /></div>
              <div className="boss-nose" />
              <div className={`boss-mouth ${speaking ? "is-speaking" : ""}`}>
                <span />
              </div>
              <div className="boss-cheek boss-cheek-left" />
              <div className="boss-cheek boss-cheek-right" />
            </div>
            <div className="boss-arm boss-arm-left" />
            <div className="boss-arm boss-arm-right" />
            <div className="boss-watch" aria-hidden="true"><span /></div>
            <div className="boss-mug" aria-hidden="true">
              <span className="boss-mug-label">mini<br />ceo</span>
              <i className="boss-mug-handle" />
              <i className="boss-steam boss-steam-one" />
              <i className="boss-steam boss-steam-two" />
            </div>
            <div className="boss-status-orbit">
              <span />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
