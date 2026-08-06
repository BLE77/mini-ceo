"use client";

import { motion, useReducedMotion } from "framer-motion";
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
  const [loadedAsset, setLoadedAsset] = useState<string | null>(null);
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const assetReady = loadedAsset === assetKey;
  const assetFailed = failedAsset === assetKey;
  const characterLabel = action
    ? `Mini CEO ${ACTION_LABELS[action]}`
    : `Mini CEO looking ${EXPRESSION_LABELS[resolvedExpression]}`;

  return (
    <motion.div
      className={`boss-character has-asset boss-${mode} mood-${mood} asset-${action ?? resolvedExpression} ${assetReady ? "boss-asset-ready" : ""} ${speaking ? "is-speaking" : ""} ${compact ? "boss-compact" : ""}`}
      aria-label={characterLabel}
      role="img"
      animate={
        reduceMotion
          ? undefined
          : {
              y: [0, -4, 0],
              rotate: mood === "impatient" ? [0, -0.8, 0.8, 0] : [0, 0.35, 0],
            }
      }
      transition={{
        duration: mood === "impatient" ? 1.8 : 4.8,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {!assetFailed && (
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
          onLoad={() => setLoadedAsset(assetKey)}
          onError={() => setFailedAsset(assetKey)}
        />
      )}
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
    </motion.div>
  );
}
