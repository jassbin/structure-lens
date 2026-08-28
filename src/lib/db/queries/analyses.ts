import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyses } from "@/lib/db/schema/analyses";
import type { AnalysisResult } from "@/lib/analysis/types";

/** 保存一次分析（按 userId 归属） */
export async function insertAnalysis(
  userId: string,
  result: AnalysisResult,
): Promise<void> {
  await db.insert(analyses).values({
    id: result.id,
    userId,
    input: result.input,
    version: result.version,
    sources: result.sources ?? null,
    verdict: result.verdict,
    steps: result.steps,
    skeleton: result.skeleton,
    walkHooks: result.walkHooks,
    revisions: result.revisions ?? null,
  });
}

/** 重算后更新一次分析（版本、步骤、结论、修订记录） */
export async function updateAnalysis(
  userId: string,
  result: AnalysisResult,
): Promise<void> {
  await db
    .update(analyses)
    .set({
      version: result.version,
      verdict: result.verdict,
      steps: result.steps,
      skeleton: result.skeleton,
      revisions: result.revisions ?? null,
    })
    .where(and(eq(analyses.id, result.id), eq(analyses.userId, userId)));
}

/** 读取本人某次分析 */
export async function getAnalysisById(
  userId: string,
  id: string,
): Promise<AnalysisResult | null> {
  const rows = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    input: row.input,
    version: row.version,
    sources: row.sources ?? undefined,
    verdict: row.verdict,
    steps: row.steps,
    skeleton: row.skeleton,
    walkHooks: row.walkHooks,
    revisions: row.revisions ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 本人最近的分析列表（用于历史，可选） */
export async function listRecentAnalyses(userId: string, limit = 20) {
  return db
    .select({
      id: analyses.id,
      input: analyses.input,
      verdict: analyses.verdict,
      createdAt: analyses.createdAt,
    })
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(limit);
}
