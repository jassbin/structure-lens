import type { InferSelectModel } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import type { StructureSkeleton } from "@/lib/analysis/types";

/**
 * 分享快照：某次分析的只读、自包含快照，用于私密短链分享。
 * 刻意不含 userId / 结构地图 / 完整步骤——只留骨架卡与金句，避免暴露隐私。
 * 免登录用户也能创建（快照自包含，不依赖分析是否落库）。
 */
export const shares = pgTable(
  "shares",
  {
    /** 短码，作为 /s/[code] 的路径 */
    code: varchar("code", { length: 16 }).primaryKey(),
    input: text("input").notNull(),
    verdict: text("verdict").notNull(),
    skeleton: jsonb("skeleton").$type<StructureSkeleton>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("shares_created_at_idx").on(table.createdAt),
  }),
);

export type ShareRow = InferSelectModel<typeof shares>;
