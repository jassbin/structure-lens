import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { upsertUser } from "@/lib/db/queries";
import { insertAnalysis } from "@/lib/db/queries/analyses";
import { mergeStructure } from "@/lib/db/queries/structure-nodes";
import type { AnalysisResult } from "@/lib/analysis/types";

/**
 * POST /api/structure-map/import  { analyses: AnalysisResult[] }
 * 后置登录：把本地累积的分析一次性并入云端结构地图。需要登录。
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const body = (await request.json().catch(() => ({}))) as {
    analyses?: AnalysisResult[];
  };
  const list = Array.isArray(body.analyses) ? body.analyses.slice(0, 100) : [];

  await upsertUser({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  }).catch(() => {});

  let imported = 0;
  for (const a of list) {
    try {
      await insertAnalysis(user.id, a).catch(() => {});
      await mergeStructure(user.id, a.skeleton, a.verdict);
      imported += 1;
    } catch (error) {
      console.error("[import] one failed", error);
    }
  }

  return NextResponse.json({ ok: true, imported });
}
