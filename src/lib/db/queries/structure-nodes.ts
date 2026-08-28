import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { structureNodes } from "@/lib/db/schema/structure-nodes";
import type { StructureNode, StructureSkeleton } from "@/lib/analysis/types";

/** 达到点亮阈值：至少 2 次碰撞、覆盖至少 2 个不同事件 */
const VERIFY_HITS = 2;

function verifiedConfidence(hits: number, base: number): number {
  // 每多一次碰撞提升置信度，封顶 92
  return Math.min(92, base + (hits - 1) * 8);
}

/**
 * 把一次分析提炼的结构骨架并入用户的结构地图：
 * - 同名结构存在：累积事件、hits +1、提升置信度，达阈值点亮为 verified
 * - 不存在：新建为 hypothesis
 */
export async function mergeStructure(
  userId: string,
  skeleton: StructureSkeleton,
  eventTitle: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(structureNodes)
    .where(
      and(
        eq(structureNodes.userId, userId),
        eq(structureNodes.name, skeleton.name),
      ),
    )
    .limit(1);

  const found = existing[0];
  if (found) {
    const events = Array.from(new Set([...found.events, eventTitle]));
    const hits = found.hits + 1;
    const verified = hits >= VERIFY_HITS && events.length >= 2;
    await db
      .update(structureNodes)
      .set({
        events,
        hits,
        state: verified ? "verified" : "hypothesis",
        confidence: verified
          ? verifiedConfidence(hits, skeleton.confidence)
          : skeleton.confidence,
        updatedAt: new Date(),
      })
      .where(eq(structureNodes.id, found.id));
    return;
  }

  await db.insert(structureNodes).values({
    id: crypto.randomUUID().slice(0, 16),
    userId,
    name: skeleton.name,
    root: skeleton.root,
    state: "hypothesis",
    confidence: skeleton.confidence,
    events: [eventTitle],
    hits: 1,
  });
}

/** 读取用户完整结构地图节点 */
export async function listStructureNodes(
  userId: string,
): Promise<StructureNode[]> {
  const rows = await db
    .select()
    .from(structureNodes)
    .where(eq(structureNodes.userId, userId))
    .orderBy(desc(structureNodes.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    root: r.root,
    state: r.state,
    confidence: r.confidence,
    events: r.events,
  }));
}
