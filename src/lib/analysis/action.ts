/**
 * 清醒行动主义（Clear-Actionism）· 6 步行动引擎
 * 定位：7 步分析让用户「看清结构」；本引擎负责「看清之后不瘫痪、去行动」。
 * 输入：一次已完成分析的 input + verdict + skeleton（真实结构）。
 * 输出：一份结构化「行动方案」JSON。
 */

/** 6 步之一 */
export type ActionStepKind =
  | "pain" // 1 痛点定位
  | "triage" // 2 可控性分诊
  | "selfDeception" // 3 自欺检测
  | "minimalAction" // 4 最小行动
  | "crack" // 5 缝隙扫描
  | "placebo"; // 6 清醒安慰剂

/** 可控性三筐 */
export type Controllability = "environment" | "behavior" | "uncontrollable";

export interface ActionPlan {
  id: string; // 与来源分析同 id
  /** 一句克制、可行动的定调（不鸡汤、不美化，但给出可动的方向） */
  headline: string;
  steps: {
    pain: {
      /** 把情绪痛还原成的信号（生物信号 / 结构信号） */
      signal: string;
      /** 这件事真正在痛的是什么 */
      whatHurts: string;
    };
    triage: {
      /** 三筐分诊：每条给「内容 + 归筐」 */
      items: { text: string; bucket: Controllability }[];
    };
    selfDeception: {
      /** 判断：能动而不动 / 无法行动 / 无法判定 */
      verdict: "able_but_idle" | "truly_unable" | "unclear";
      /** 点破/共情的话（able_but_idle 点破，truly_unable 共情） */
      note: string;
      /** 自检问句（照手册 4 条自检精神，2-4 条） */
      checks: string[];
    };
    minimalAction: {
      /** 针对「可改变」的 1-3 个今天就能做的最小行动 */
      actions: { title: string; how: string }[];
    };
    crack: {
      /** 针对结构，1-2 个现实缝隙（类型 + 具体做法） */
      cracks: { kind: string; detail: string }[];
    };
    placebo: {
      /** 针对「不可改变」的、不自欺的调节法 1-3 个 */
      regulations: string[];
      /** 一句收尾原则（呼应四条最终原则之一，可改写贴合本事件） */
      closingPrinciple: string;
    };
  };
}

export const ACTION_SYSTEM_PROMPT = `你是「清醒行动主义（Clear-Actionism）」行动引擎。用户刚用「结构透镜」看清了一件事的底层结构（我们会给你：原始困惑、金句结论、真实结构骨架）。现在你的任务不是再分析，而是帮他**从"看清"走到"不瘫痪地行动"**。

## 世界观（严格遵守，不许滑向鸡汤）
- 痛是信号，不是命运；不美化痛苦、不赋予它超验意义。
- 行动优先于反思；盲目行动也好过原地内耗（至少能拿到反馈）。
- 可改变则改，不可改变则用"清醒安慰剂"调节——使用它，但绝不误当真理。
- 区分"能动而不动"（批判、点破）与"真的无法行动"（共情、给调节）。
- 语气：冷静、诚实、克制，但**务必给出可动的具体抓手**，降低无力感——不是冷冰冰甩结论，也不是灌情绪安慰。

## 6 步行动引擎（逐步产出，别跳步）
1. 痛点定位：把用户这件事里的情绪痛，还原成一个更冷静的"信号"——是生物信号（怕、累、受威胁）还是结构信号（被某个刚性结构挤压）。说清"真正在痛的是什么"。
2. 可控性分诊：把这件事拆成若干条，每条归入三筐之一——environment（可改变外部环境：换、离、搬、找）/ behavior（可改变自身行为或认知）/ uncontrollable（当前几乎无法改变，只能调节）。诚实归筐，别把不可控硬说成可控。
3. 自欺检测：判断用户在这件事上更像"能动而不动"(able_but_idle) 还是"真的无法行动"(truly_unable)，拿不准给 unclear。是前者就温和点破他可能在用"看透了/不需要"回避恐惧；是后者就共情、不催促。给 2-4 条自检问句帮他自己照。
4. 最小行动：只针对第2步归为 environment/behavior 的部分，给 1-3 个**今天/本周就能做的最小行动**（5 分钟就能起步、可迭代），每条给"做什么 + 怎么做"。具体到能立刻执行，别给"要努力""要调整心态"这种空话。
5. 缝隙扫描：针对结构性的、暂时改不动的部分，找 1-2 个现实"缝隙"（规则不一致、监管空白、利益裂痕、技术新空间、政策/福利可用之处）——不是投机，是策略性生存。给"缝隙类型 + 具体怎么利用"。
6. 清醒安慰剂：针对第2步归为 uncontrollable 的部分，给 1-3 个**不自欺的调节法**（如观察者练习、生理优先、转移注意、限定反刍时间）——明确这是止痛不是治本。最后给一句收尾原则，改写贴合这件事（可参考："你不是你的结构，但结构是你不快乐的根源""你不是你的痛苦，但痛苦是信号""你不是你的地下室，但你可以走出来"）。

## 硬约束
- 全程紧扣用户这件具体的事和它的真实结构，不要泛泛而谈方法论本身。
- 诚实：改不动就说改不动，别为了正能量硬造希望。
- 不做医疗/法律/心理诊断；若涉及自伤、重度抑郁、违法等，务必在相应步骤温和提示寻求专业/线下帮助，不替代专业。
- headline 是一句冷静但给方向的定调（20-40字），不喊口号。

## 输出格式（只输出一个 JSON 对象，不要 markdown、不要多余文字）
{
  "headline": "一句冷静而可行动的定调",
  "steps": {
    "pain": { "signal": "还原成的信号（生物/结构）", "whatHurts": "真正在痛的是什么" },
    "triage": { "items": [ { "text": "这件事的某一面", "bucket": "environment|behavior|uncontrollable" } ] },
    "selfDeception": { "verdict": "able_but_idle|truly_unable|unclear", "note": "点破或共情的话", "checks": ["自检问句1","自检问句2"] },
    "minimalAction": { "actions": [ { "title": "最小行动", "how": "具体怎么做，今天就能起步" } ] },
    "crack": { "cracks": [ { "kind": "缝隙类型", "detail": "具体怎么利用" } ] },
    "placebo": { "regulations": ["不自欺的调节法1"], "closingPrinciple": "一句贴合本事件的收尾原则" }
  }
}
严格用中文。只输出这个 JSON 对象。`;

/* ------------------------------- 解析与兜底 ------------------------------- */

const BUCKETS: Controllability[] = ["environment", "behavior", "uncontrollable"];
const SD: ActionPlan["steps"]["selfDeception"]["verdict"][] = [
  "able_but_idle",
  "truly_unable",
  "unclear",
];

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** 把模型返回的松散对象规整成安全的 ActionPlan（缺字段兜底，绝不抛错到 UI） */
export function normalizeActionPlan(raw: unknown, id: string): ActionPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (r.steps ?? {}) as Record<string, unknown>;
  const pain = (s.pain ?? {}) as Record<string, unknown>;
  const triage = (s.triage ?? {}) as Record<string, unknown>;
  const sd = (s.selfDeception ?? {}) as Record<string, unknown>;
  const ma = (s.minimalAction ?? {}) as Record<string, unknown>;
  const crack = (s.crack ?? {}) as Record<string, unknown>;
  const placebo = (s.placebo ?? {}) as Record<string, unknown>;

  return {
    id,
    headline: str(r.headline, "看清之后，先从一个能动的小处开始。"),
    steps: {
      pain: {
        signal: str(pain.signal),
        whatHurts: str(pain.whatHurts),
      },
      triage: {
        items: arr(triage.items)
          .map((it) => {
            const o = (it ?? {}) as Record<string, unknown>;
            const bucket = BUCKETS.includes(o.bucket as Controllability)
              ? (o.bucket as Controllability)
              : "uncontrollable";
            return { text: str(o.text), bucket };
          })
          .filter((it) => it.text),
      },
      selfDeception: {
        verdict: SD.includes(sd.verdict as (typeof SD)[number])
          ? (sd.verdict as (typeof SD)[number])
          : "unclear",
        note: str(sd.note),
        checks: arr(sd.checks).map((c) => str(c)).filter(Boolean),
      },
      minimalAction: {
        actions: arr(ma.actions)
          .map((a) => {
            const o = (a ?? {}) as Record<string, unknown>;
            return { title: str(o.title), how: str(o.how) };
          })
          .filter((a) => a.title || a.how),
      },
      crack: {
        cracks: arr(crack.cracks)
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>;
            return { kind: str(o.kind), detail: str(o.detail) };
          })
          .filter((c) => c.detail),
      },
      placebo: {
        regulations: arr(placebo.regulations).map((x) => str(x)).filter(Boolean),
        closingPrinciple: str(
          placebo.closingPrinciple,
          "你不是你的结构，但结构是你不快乐的根源。",
        ),
      },
    },
  };
}
