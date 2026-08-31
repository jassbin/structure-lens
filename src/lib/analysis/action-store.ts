"use client";

import type { ActionPlan } from "@/lib/analysis/action";

/**
 * 免登录本地行动方案（清醒行动主义）持久化。
 * 策略与 local-map 一致：localStorage 存 Record<id, ActionPlan>，
 * 方案 id 与来源分析同 id。登录用户走云端（analyses.action_plan 列）。
 */
const KEY = "structure-lens:local-actions";

function readAll(): Record<string, ActionPlan> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActionPlan>) : {};
  } catch {
    return {};
  }
}

export function saveLocalActionPlan(plan: ActionPlan): void {
  if (typeof window === "undefined" || !plan?.id) return;
  try {
    const all = readAll();
    all[plan.id] = plan;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function getLocalActionPlan(id: string): ActionPlan | null {
  return readAll()[id] ?? null;
}

export function getAllLocalActionPlans(): ActionPlan[] {
  return Object.values(readAll());
}
