import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { upsertUser } from "@/lib/db/queries";
import {
  insertAnalysis,
  listAllAnalysesFull,
} from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * POST /api/structure-map/sync  { analyses: AnalysisResult[] }
 * 双向同步（需要登录）：
 *  1) 把本地有、云端没有的分析写入云端（并入云端结构地图）；已在云端的跳过，避免重复累计 hits。
 *  2) 返回云端「全部」分析（合并后），供前端把云端有、本地没有的回流到 localStorage。
 * 结果：本地与云端取并集，两边数据都完整。
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    analyses?: AnalysisResult[];
  };
  const local = Array.isArray(body.analyses) ? body.analyses.slice(0, 500) : [];

  await upsertUser({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }).catch(() => {});

  // 云端现有分析（用于判重，避免重复 insert / 重复累计结构 hits）
  const existing = await listAllAnalysesFull(user.id).catch(() => []);
  const cloudIds = new Set(existing.map((a) => a.id));

  let pushed = 0;
  for (const a of local) {
    if (!a?.id || cloudIds.has(a.id)) continue;
    try {
      await insertAnalysis(user.id, a).catch(() => {});
      await mergeStructure(user.id, a.skeleton, a.verdict);
      cloudIds.add(a.id);
      pushed += 1;
    } catch (error) {
      console.error("[sync] push one failed", error);
    }
  }

  // 合并后云端全量（供前端回流本地缺失的部分）
  const cloudAll = await listAllAnalysesFull(user.id).catch(() => existing);

  return NextResponse.json({ ok: true, pushed, analyses: cloudAll });
}
