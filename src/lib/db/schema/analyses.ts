import type { InferSelectModel } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import type {
  AnalysisLayer,
  SearchSource,
  StructureSkeleton,
  WalkHook,
} from "@/lib/analysis/types";

/** 一次完整的深度分析（按 userId 归属） */
export const analyses = pgTable(
  "analyses",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id),
    input: text("input").notNull(),
    alignedSummary: text("aligned_summary"),
    sources: jsonb("sources").$type<SearchSource[]>(),
    verdict: text("verdict").notNull(),
    layers: jsonb("layers").$type<AnalysisLayer[]>().notNull(),
    skeleton: jsonb("skeleton").$type<StructureSkeleton>().notNull(),
    strongestRebuttal: text("strongest_rebuttal").notNull(),
    blindSpot: text("blind_spot").notNull(),
    walkHooks: jsonb("walk_hooks").$type<WalkHook[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("analyses_user_idx").on(table.userId),
    createdAtIdx: index("analyses_created_at_idx").on(table.createdAt),
  }),
);

export type AnalysisRow = InferSelectModel<typeof analyses>;
