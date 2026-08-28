"use client";

import { useEffect, useState } from "react";

/** 隐私安全的确定性演示数据（不引用任何真实用户数据、不触网） */
const COVER_PREVIEW_DATA = {
  verdictLabel: "核心暴击",
  verdict: "用来改革中间层的工具，本身就是中间层。",
  layerLabel: "三层下钻",
  points: [
    "表面：法令设计不周、执行走样。",
    "深层：改革者与执行者的激励不一致。",
    "底层：工具与被改造对象同体。",
  ],
  confidenceLabel: "置信度",
  confidence: 76,
};

/**
 * 封面自动演示：金句暴击浮现 → 逐点展开 → 置信度条填充 → 循环。
 * 纯本地状态机，无点击、无 auth、不触碰产品状态。
 */
export function CoverPreview() {
  const [phase, setPhase] = useState(0); // 0 verdict, 1..3 points, 4 bar, then loop
  const [barFill, setBarFill] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setPhase(0);
      setBarFill(0);
      timers.push(setTimeout(() => setPhase(1), 700));
      timers.push(setTimeout(() => setPhase(2), 1300));
      timers.push(setTimeout(() => setPhase(3), 1900));
      timers.push(
        setTimeout(() => {
          setPhase(4);
          setBarFill(COVER_PREVIEW_DATA.confidence);
        }, 2500),
      );
    };
    cycle();
    const loop = setInterval(cycle, 4200);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, []);

  const d = COVER_PREVIEW_DATA;

  return (
    <div
      className="flex h-full w-full flex-col gap-4 p-5"
      style={{ background: "#FFF8EC", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* 金句暴击 */}
      <div
        className="rounded-3xl p-5 text-white transition-all duration-500"
        style={{
          background: "#0C5FFD",
          boxShadow: "0 18px 44px rgba(12,95,253,0.28)",
          opacity: phase >= 0 ? 1 : 0,
          transform: phase >= 0 ? "translateY(0)" : "translateY(8px)",
        }}
      >
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          {d.verdictLabel}
        </span>
        <p
          className="mt-2 text-2xl font-black leading-tight"
          style={{ fontFamily: "Nunito, Inter, sans-serif" }}
        >
          {d.verdict}
        </p>
      </div>

      {/* 展开层 */}
      <div
        className="flex-1 rounded-2xl border p-4"
        style={{ background: "#FFFDF7", borderColor: "#ECE2CE" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-full text-xs font-black"
            style={{ background: "rgba(12,95,253,0.1)", color: "#0C5FFD" }}
          >
            2
          </span>
          <span className="text-sm font-bold" style={{ color: "#111" }}>
            {d.layerLabel}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {d.points.map((p, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm transition-all duration-400"
              style={{
                color: "#111",
                opacity: phase >= i + 1 ? 1 : 0,
                transform: phase >= i + 1 ? "translateX(0)" : "translateX(-6px)",
              }}
            >
              <span
                className="mt-2 h-1 w-1 shrink-0 rounded-full"
                style={{ background: "#0C5FFD" }}
              />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2">
          <span
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "#6B6B62" }}
          >
            {d.confidenceLabel}
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "#F4ECD9" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${barFill}%`, background: "#0C5FFD" }}
            />
          </div>
          <span
            className="w-9 text-right text-xs font-bold tabular-nums"
            style={{ color: "#111" }}
          >
            {barFill}%
          </span>
        </div>
      </div>
    </div>
  );
}
