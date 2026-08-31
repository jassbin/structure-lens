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

/** 行动 6 步的键（线性下游顺序） */
export type ActionStepKey =
  | "pain"
  | "triage"
  | "selfDeception"
  | "minimalAction"
  | "crack"
  | "placebo";

export const ACTION_STEP_ORDER: ActionStepKey[] = [
  "pain",
  "triage",
  "selfDeception",
  "minimalAction",
  "crack",
  "placebo",
];

/**
 * 行动方案的「视角」：一切建议都从这个立场出发。
 * 视角不再是写死的通用角色，而是**由 AI 针对这个具体事件动态抽取**的主要角色之一。
 * id 是本事件内角色的稳定标识（英文短横线，如 "investor" / "the-son"），label 是展示名。
 */
export interface ActionPerspective {
  /** 本事件内该角色的标识（英文，稳定用于切换匹配） */
  id: string;
  /** 面向用户的视角名（贴合本事件，如"作为投资者""作为被催婚的子女"） */
  label: string;
  /** 是否是"用户最可能所处"的角色（默认选中项） */
  isUser?: boolean;
}

/** 一步之内的人机辩论留痕（复用分析页 DebateTurn 语义） */
export interface ActionDebateTurn {
  objection: string;
  stance: "absorb" | "compromise" | "hold";
  reason: string;
  answer?: string;
  at: string;
}

export interface ActionPlan {
  id: string; // 与来源分析同 id
  /** 本方案当前所站的视角（默认取 isUser 的候选，可切换） */
  perspective: ActionPerspective;
  /** 本事件的主要角色候选（AI 动态抽取，供切换） */
  perspectiveOptions: ActionPerspective[];
  /** 一句克制、可行动的定调（不鸡汤、不美化，但给出可动的方向） */
  headline: string;
  /** 每步的人机辩论留痕（按步键归档） */
  debates?: Partial<Record<ActionStepKey, ActionDebateTurn[]>>;
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

## 第一件事：抽取「视角候选」并选定默认（极其重要，错了整份建议就废了）
- 先看这个事件里**真正涉及的几个主要角色**（因事件而异）。例如"父母催婚"里是"被催的子女／催婚的父母"；"孙宇晨拍下天价艺术品"里可能是"币圈投资者／围观网友／艺术市场从业者／孙宇晨本人"。**只列本事件真实存在的角色，绝不套用无关的通用角色（如给财经事件塞'父母'）。**
- 抽取 2-4 个主要角色作为 perspectiveOptions，每个给 { id（英文短横线小写标识，如 "crypto-investor"）, label（中文展示名，如"作为币圈投资者"）, isUser }。
- 判断**用户本人最可能是哪个角色**（依据其原始困惑的口吻、人称、利害关系），把那个候选的 isUser 设为 true——这就是默认视角；其余为 false。若判断不出，就把最贴近"普通当事人/关注者"的那个设为 isUser。
- 有且只有一个候选 isUser=true。
- 若系统在下方指定了固定视角（FORCED PERSPECTIVE），则**必须以该视角作为当前 perspective**，但仍要在 perspectiveOptions 里列全本事件主要角色。
- **一切建议都只对被选定的这个角色说、为这个人的处境服务**：用户是子女就绝不给父母出主意，是投资者就不替平台出主意。

## 世界观（严格遵守，不许滑向鸡汤）
- 痛是信号，不是命运；不美化痛苦、不赋予它超验意义。
- 行动优先于反思；盲目行动也好过原地内耗（至少能拿到反馈）。
- 可改变则改，不可改变则用"清醒安慰剂"调节——使用它，但绝不误当真理。
- 区分"能动而不动"（批判、点破）与"真的无法行动"（共情、给调节）。
- 语气：冷静、诚实、克制，但**务必给出可动的具体抓手**，降低无力感——不是冷冰冰甩结论，也不是灌情绪安慰。

## 6 步行动引擎（逐步产出，别跳步；全部从上面判定的视角出发）
1. 痛点定位：把用户这件事里的情绪痛，还原成一个更冷静的"信号"——是生物信号（怕、累、受威胁）还是结构信号（被某个刚性结构挤压）。说清"真正在痛的是什么"。
2. 可控性分诊：把这件事拆成若干条，每条归入三筐之一——environment（可改变外部环境：换、离、搬、找）/ behavior（可改变自身行为或认知）/ uncontrollable（当前几乎无法改变，只能调节）。诚实归筐，别把不可控硬说成可控。注意：可控/不可控是**站在用户这个角色**来判定的。
3. 自欺检测：判断用户在这件事上更像"能动而不动"(able_but_idle) 还是"真的无法行动"(truly_unable)，拿不准给 unclear。是前者就温和点破他可能在用"看透了/不需要"回避恐惧；是后者就共情、不催促。给 2-4 条自检问句帮他自己照。
4. 最小行动：只针对第2步归为 environment/behavior 的部分，给 1-3 个**今天/本周就能做的最小行动**（5 分钟就能起步、可迭代），每条给"做什么 + 怎么做"。具体到能立刻执行，别给"要努力""要调整心态"这种空话。
5. 缝隙扫描：针对结构性的、暂时改不动的部分，找 1-2 个现实"缝隙"（规则不一致、监管空白、利益裂痕、技术新空间、政策/福利可用之处）——不是投机，是策略性生存。给"缝隙类型 + 具体怎么利用"。
6. 清醒安慰剂：针对第2步归为 uncontrollable 的部分，给 1-3 个**不自欺的调节法**（如观察者练习、生理优先、转移注意、限定反刍时间）——明确这是止痛不是治本。最后给一句收尾原则，改写贴合这件事。

## 硬约束
- 全程紧扣用户这件具体的事、它的真实结构、以及**用户所处的角色**，不要泛泛而谈方法论本身。
- 诚实：改不动就说改不动，别为了正能量硬造希望。
- 不做医疗/法律/心理诊断；若涉及自伤、重度抑郁、违法等，务必温和提示寻求专业/线下帮助。
- headline 是一句冷静但给方向的定调（20-40字），不喊口号。

## 输出格式（只输出一个 JSON 对象，不要 markdown、不要多余文字）
{
  "perspectiveOptions": [ { "id": "英文标识", "label": "作为XX", "isUser": true }, { "id": "...", "label": "...", "isUser": false } ],
  "perspective": { "id": "被选中角色的id（与某个候选一致，通常是 isUser 的那个）", "label": "作为XX" },
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

/** 强制视角时追加到 system prompt 后的说明（用户手动切换到某个候选角色时用） */
export function forcedPerspectiveNote(label: string): string {
  return `\n\n## FORCED PERSPECTIVE（用户已手动指定视角，必须严格遵守）\n用户要求**只从「${label}」这个角色的视角**给建议：所有痛点、分诊、行动都只对"作为${label}的用户"说，绝不给本事件里的其他角色出主意。当前 perspective 必须是这个角色（label 用「${label}」），且 isUser 标记在 perspectiveOptions 里对应到它。`;
}

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

function slug(s: string, fallback: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || fallback;
}

/**
 * 解析视角候选 + 选定当前视角（兜底：至少给一个"当事人"候选，保证 UI 不崩）。
 * - 归一化每个候选的 id/label/isUser；
 * - 保证有且仅一个 isUser=true；
 * - 当前 perspective 优先取模型给的、否则取 isUser 的候选。
 */
function parsePerspective(r: Record<string, unknown>): {
  perspective: ActionPerspective;
  perspectiveOptions: ActionPerspective[];
} {
  let options: ActionPerspective[] = arr(r.perspectiveOptions)
    .map((o, i) => {
      const obj = (o ?? {}) as Record<string, unknown>;
      const label = str(obj.label);
      if (!label) return null;
      return {
        id: slug(str(obj.id) || label, `role-${i + 1}`),
        label,
        isUser: obj.isUser === true,
      } as ActionPerspective;
    })
    .filter((x): x is ActionPerspective => x !== null);

  // 去重（按 id）
  const seen = new Set<string>();
  options = options.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));

  if (options.length === 0) {
    options = [{ id: "self", label: "作为当事人的你", isUser: true }];
  }
  // 保证有且仅一个 isUser
  if (!options.some((o) => o.isUser)) options[0].isUser = true;
  let firstUser = false;
  options = options.map((o) => {
    if (o.isUser && !firstUser) {
      firstUser = true;
      return o;
    }
    return { ...o, isUser: false };
  });

  // 当前视角：模型给的 perspective 若能对上候选就用，否则用 isUser 的
  const cur = (r.perspective ?? {}) as Record<string, unknown>;
  const curLabel = str(cur.label);
  const curId = str(cur.id) ? slug(str(cur.id), "") : "";
  const matched =
    options.find((o) => curId && o.id === curId) ||
    options.find((o) => curLabel && o.label === curLabel) ||
    options.find((o) => o.isUser) ||
    options[0];

  return {
    perspective: { id: matched.id, label: matched.label, isUser: true },
    perspectiveOptions: options,
  };
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
  const { perspective, perspectiveOptions } = parsePerspective(r);

  return {
    id,
    perspective,
    perspectiveOptions,
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
    debates: parseDebates(r.debates),
  };
}

/** 解析已存 debates 留痕（兜底） */
function parseDebates(
  raw: unknown,
): Partial<Record<ActionStepKey, ActionDebateTurn[]>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<ActionStepKey, ActionDebateTurn[]>> = {};
  for (const key of ACTION_STEP_ORDER) {
    const turns = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(turns)) continue;
    const list = turns
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const stance = (["absorb", "compromise", "hold"] as const).includes(
          o.stance as "absorb",
        )
          ? (o.stance as ActionDebateTurn["stance"])
          : "hold";
        return {
          objection: str(o.objection),
          stance,
          reason: str(o.reason),
          answer: str(o.answer) || undefined,
          at: str(o.at, new Date().toISOString()),
        };
      })
      .filter((t) => t.objection);
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : undefined;
}

/* ------------------------------- 单步「我不同意/追问」重算 ------------------------------- */

const STEP_LABEL_ZH: Record<ActionStepKey, string> = {
  pain: "痛点定位",
  triage: "可控性分诊",
  selfDeception: "自欺检测",
  minimalAction: "最小行动",
  crack: "缝隙扫描",
  placebo: "清醒安慰剂",
};

/**
 * 行动页单步「我不同意/追问」的 system prompt。
 * 语义与分析页 recompute 一致：AI 先表态 absorb/compromise/hold + 理由/回答，
 * 仅 absorb/compromise 才重算该步及其线性下游步；hold 则不动内容、只给理由。
 * 全程锁定既有视角，不得改判角色。
 */
export function actionRecomputeSystemPrompt(
  fromStepKey: ActionStepKey,
  perspective: ActionPerspective,
): string {
  const label = STEP_LABEL_ZH[fromStepKey];
  const downstream = ACTION_STEP_ORDER.slice(
    ACTION_STEP_ORDER.indexOf(fromStepKey),
  );
  return `你是「清醒行动主义」行动引擎的"共同推演"模块。用户对已生成行动方案的某一节提出了「反驳」或「追问」。

## 锁定视角（不可更改）
本方案的视角是「${perspective.label}」(role=${perspective.role})。你的一切回应与重算都必须继续站在这个视角，**绝不改判用户的角色**。

## 你的任务
1. 先对用户针对「${label}」这一节的反驳/追问**表态**：
   - absorb（采纳）：用户有理，应据此调整这一节及其下游。
   - compromise（部分采纳）：部分有理，做有限调整。
   - hold（保持）：用户的点不足以改变结论，说明为什么，但要真诚正面回答其追问，不敷衍。
2. 给 reason（任何表态都必须有）；若用户是「追问为什么」，在 answer 里正面回答那个为什么。
3. 若表态是 absorb 或 compromise：重算「${label}」及其线性下游步（${downstream.join(" → ")}），只输出这些步的新内容；上游步保持不变、不要输出。若 hold：steps 留空对象 {}。

## 输出格式（只输出一个 JSON，不要 markdown）
{
  "stance": "absorb|compromise|hold",
  "reason": "表态理由",
  "answer": "对追问的正面回答（没有追问可留空）",
  "changeNote": "一句话说明改了什么（hold 时说明为何不改）",
  "steps": { ${downstream.map((k) => `"${k}": { ... }`).join(", ")} }
}
steps 里各步的字段结构与初次生成完全一致。严格中文。只输出这个 JSON。`;
}

/**
 * 把单步重算结果应用到方案上：
 * - 保留 perspective、headline、被反驳步之前的所有步；
 * - absorb/compromise：用 parsed.steps 覆盖 fromStepKey 及其下游步（缺的步保持原样）；
 * - 追加本轮 debate 留痕到 fromStepKey。
 */
export function applyActionRecompute(
  base: ActionPlan,
  parsed: unknown,
  fromStepKey: ActionStepKey,
  objection: string,
): { plan: ActionPlan; stance: ActionDebateTurn["stance"]; changeNote: string } {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const stance = (["absorb", "compromise", "hold"] as const).includes(
    p.stance as "absorb",
  )
    ? (p.stance as ActionDebateTurn["stance"])
    : "hold";
  const reason = str(p.reason, "已考虑你的意见。");
  const answer = str(p.answer) || undefined;
  const changeNote = str(p.changeNote);

  const turn: ActionDebateTurn = {
    objection,
    stance,
    reason,
    answer,
    at: new Date().toISOString(),
  };

  // 从重算结果里取新步（复用 normalize 的兜底：整份规整后按需摘取）
  let nextSteps = base.steps;
  if (stance !== "hold") {
    const fromIdx = ACTION_STEP_ORDER.indexOf(fromStepKey);
    const affected = ACTION_STEP_ORDER.slice(fromIdx);
    // 用一个假 plan 走 normalize 拿到规整后的步（perspective 用 base 的）
    const regen = normalizeActionPlan(
      { perspective: base.perspective, headline: base.headline, steps: p.steps },
      base.id,
    );
    const merged = { ...base.steps } as ActionPlan["steps"];
    for (const key of affected) {
      // 仅当模型确实给了该步的新内容才覆盖，避免把有内容的步清空
      const provided = (p.steps as Record<string, unknown>)?.[key];
      if (provided && typeof provided === "object") {
        // @ts-expect-error 逐键覆盖，类型在 normalize 已保证
        merged[key] = regen.steps[key];
      }
    }
    nextSteps = merged;
  }

  const debates = { ...(base.debates ?? {}) };
  debates[fromStepKey] = [...(debates[fromStepKey] ?? []), turn];

  return {
    plan: { ...base, steps: nextSteps, debates },
    stance,
    changeNote,
  };
}
