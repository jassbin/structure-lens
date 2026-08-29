import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { shares } from "@/lib/db/schema/shares";
import type { StructureSkeleton } from "@/lib/analysis/types";

export interface ShareSnapshot {
  input: string;
  verdict: string;
  skeleton: StructureSkeleton;
}

export interface ShareRecord extends ShareSnapshot {
  code: string;
  createdAt: string;
}

/** 生成一个不易撞车的短码（8 位 base36） */
function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((b) => (b % 36).toString(36))
    .join("");
}

/** 创建一份只读分享快照，返回短码。免登录可用。 */
export async function createShare(snapshot: ShareSnapshot): Promise<string> {
  // 极小概率撞码则重试几次
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      await db.insert(shares).values({
        code,
        input: snapshot.input,
        verdict: snapshot.verdict,
        skeleton: snapshot.skeleton,
      });
      return code;
    } catch {
      // 撞主键，换一个再试
    }
  }
  throw new Error("failed to allocate share code");
}

/** 按短码读取只读分享快照 */
export async function getShare(code: string): Promise<ShareRecord | null> {
  const rows = await db.select().from(shares).where(eq(shares.code, code)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    code: row.code,
    input: row.input,
    verdict: row.verdict,
    skeleton: row.skeleton,
    createdAt: row.createdAt.toISOString(),
  };
}
