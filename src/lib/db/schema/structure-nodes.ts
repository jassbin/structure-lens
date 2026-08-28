import type { InferSelectModel } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { RootStructure, StructureNodeState } from "@/lib/analysis/types";

/**
 * 结构地图节点（按 userId 归属）。
 * 每次分析提炼的结构以命名归并：同名结构累积 events、提升置信度，
 * 出现次数达到阈值即从 hypothesis 点亮为 verified。
 */
export const structureNodes = pgTable(
  "structure_nodes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 128 })
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 256 }).notNull(),
    root: varchar("root", { length: 32 }).$type<RootStructure>().notNull(),
    state: varchar("state", { length: 16 }).$type<StructureNodeState>().notNull(),
    confidence: integer("confidence").notNull(),
    /** 该结构出现过的事件标题列表 */
    events: jsonb("events").$type<string[]>().notNull(),
    /** 碰撞次数：达到阈值点亮 */
    hits: integer("hits").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("structure_nodes_user_idx").on(table.userId),
    nameIdx: index("structure_nodes_name_idx").on(table.name),
  }),
);

export type StructureNodeRow = InferSelectModel<typeof structureNodes>;
