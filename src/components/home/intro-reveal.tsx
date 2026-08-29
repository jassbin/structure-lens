"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";

const SEEN_KEY = "structure-lens:intro-seen";

/** 开场时飞过的热点词（纯装饰，营造"扫描热点"的氛围） */
const HOT_WORDS = [
  "补贴大战", "明星塌房", "天价拍卖", "算法推荐", "县城消费", "AI 裁员", "meme 币",
];

/** 骨架线框的节点坐标（0-100 视口比例），连线拼出一副"骨架" */
const NODES = [
  { x: 50, y: 18 },
  { x: 26, y: 40 },
  { x: 74, y: 40 },
  { x: 38, y: 66 },
  { x: 62, y: 66 },
  { x: 50, y: 84 },
];
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 2], [3, 4],
];

/**
 * ① 骨架雷达开场动效（3 秒炸场）：
 * 雷达扫描环 + 热点词飞过 → 锁定 → "咔"地拼出一副骨架线框 → 定调"看穿结构"。
 * 仅每会话播一次、可跳过、尊重 reduced-motion。纯视觉遮罩，不阻断后续交互。
 */
export function IntroReveal() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 已看过 / 偏好减少动效 → 不播
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (seen || reduce) return;
    setShow(true);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    timer.current = setTimeout(() => setShow(false), 2600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reduce]);

  function skip() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-el="intro-reveal"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={skip}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-[#05060B]"
        >
          {/* 雷达扫描环 */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[320px] w-[320px]">
              {[0, 1, 2].map((r) => (
                <motion.span
                  key={r}
                  className="absolute inset-0 rounded-full border border-primary/25"
                  initial={{ scale: 0.3, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 1.4, delay: r * 0.35, repeat: 1 }}
                />
              ))}
              {/* 扫描指针 */}
              <motion.span
                className="absolute left-1/2 top-1/2 h-[160px] w-[2px] origin-top bg-gradient-to-b from-primary to-transparent"
                style={{ translateX: "-50%" }}
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.3, ease: "linear", repeat: 1 }}
              />
            </div>
          </div>

          {/* 热点词飞过 */}
          <div className="pointer-events-none absolute inset-0">
            {HOT_WORDS.map((w, i) => (
              <motion.span
                key={w}
                className="absolute whitespace-nowrap text-xs font-semibold text-white/30"
                style={{ left: `${8 + ((i * 13) % 80)}%`, top: `${14 + ((i * 29) % 70)}%` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 0.6, 0], y: -14 }}
                transition={{ duration: 1.1, delay: 0.15 + i * 0.09 }}
              >
                {w}
              </motion.span>
            ))}
          </div>

          {/* 骨架线框：延迟出现，模拟"锁定后拼出骨架" */}
          <motion.svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            className="relative h-[260px] w-[260px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.05, duration: 0.3 }}
          >
            {EDGES.map(([a, b], i) => (
              <motion.line
                key={i}
                x1={NODES[a].x}
                y1={NODES[a].y}
                x2={NODES[b].x}
                y2={NODES[b].y}
                stroke="url(#introGrad)"
                strokeWidth={0.7}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9 }}
                transition={{ delay: 1.1 + i * 0.06, duration: 0.35 }}
              />
            ))}
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={1.8}
                fill="#3B82F6"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.5 + i * 0.05, duration: 0.25, type: "spring" }}
              />
            ))}
            <defs>
              <linearGradient id="introGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </motion.svg>

          {/* 定调文案 */}
          <motion.p
            className="relative mt-4 text-center font-heading text-lg font-black tracking-wide text-white"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.75, duration: 0.4 }}
          >
            {t("intro.tagline", "每个事件，都有一副看不见的骨架")}
          </motion.p>

          <button
            type="button"
            onClick={skip}
            className="absolute bottom-8 right-6 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/60"
          >
            {t("intro.skip", "跳过")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
