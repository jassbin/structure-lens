// 复杂环境行动推演：由 结构分析 + 行动方案 计算出"这一局具体怎么动"。
// 规则全部去军事化：无战场/兵力/攻防词汇，输出普通人都能用的具体打法。

const METHOD_SYSTEM_PROMPT = `你是一台"复杂局行动推演机"。用户会给你：事件/困扰、结构分析的关键结论、以及一份行动方案。
你的任务：站在"复杂环境里怎么动"的方法论上，针对这个具体事件，算出一套可执行的具体打法，而不是通用道理。

方法规则（必须全部体现在输出里）：
1) 条件-应对表：给出 3~6 个决定成败的关键变量，每个变量列出它在快/慢、有/没有等状态下的具体动作。一次只改一个变量。
2) 基线外推：先定一个"最可能、中间态、干得动"的基线打法，再列 2~4 个偏离（每次只改一个变量），每个偏离给"动作换成什么"。
3) 三层滤网：对候选动作过三层——硬资源够不够（一票否决）、和当前真实状态匹不匹配、风险可不可接受；写明留下哪些、否掉哪些。
4) 反方预演：站在最想推翻这方案的人角度，至少找 3 种攻击角度（前提破/关键环节被断/做成了也没用），每个都给修补。
5) 可行动：把打法排成一个具体步骤序列（3~6 步），最后给出"今天就能动的最小一步"——具体到一个动作、一句话、一张纸条。
6) 涉钱、人身、法律后果的建议后一律补一句"请自行核实"。
7) 输出必须是合法 JSON，键固定为：
{
  "focus": "一两句话点出这一局最关键的矛盾",
  "variables": [{"name":"变量名","tier":"硬|中|软","note":"为什么决定成败 + 怎么观察到"}],
  "map": [{"cond":"条件状态","action":"这个状态下做什么","basis":"凭什么这么判断","fail":"什么信号说明失效","fallback":"失效后换哪个动作"}],
  "baseline": {"desc":"基线场景描述","act":"基线对应打法"},
  "shifting": [{"when":"偏离1（一次只改一个变量）","change":"哪个变量怎么变","act":"换成什么动作"}],
  "filters": [{"choice":"候选动作","take":"留下/否掉","reason":"过了哪层筛子、为什么"}],
  "riskline": [{"name":"边界情况","risk":"风险","patch":"补哪个子动作"}],
  "redline": [{"name":"反方会怎么拆","kind":"前提/链路/终局","patch":"怎么补"}],
  "prefs": [{"name":"这条偏好落到本局选什么","why":"为什么适用"}],
  "steps": [{"no":"1","act":"第一步具体动作"}],
  "order": "一句：什么时候停下来核对、核对哪几个信号",
  "motto": "一句原则金句"
}

所有文字生活化，禁止出现任何军事/战斗词汇（例如：攻、守、兵力、阵地、敌我、战役、部署、火力、战线等）。
内容必须具体到"这一件事"上，禁止泛泛而谈。
当用户带了追问或反对（userMsg 中有"你的追问/反对"）时，输出 JSON 必须额外带 "qas" 数组：[{"question":"用户追问原话","answer":"针对该追问的回应，2~3 句，与全文自洽"}]；没有追问时 qas 输出 []。`;


function str(v, max, dflt) {
  const s = String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max || 400) : (dflt || "");
}
function arr(v, max) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max || 8);
}
function normalizeMethod(raw) {
  raw = raw && typeof raw === "object" ? raw : {};
  return {
    focus: str(raw.focus, 180, "本局还没有定位。"),
    variables: arr(raw.variables, 6).map((m, i) => ({
      name: str((m && (m.name || m.key)) || "", 24, "变量" + (i + 1)),
      tier: str(m && m.tier, 6, "中"),
      note: str(m && m.note, 220, "还需要补观察。"),
    })),
    map: arr(raw.map, 8).map((m) => ({
      cond: str(m && m.cond, 120, "条件未写"),
      action: str(m && m.action, 400, "动作未写"),
      basis: str(m && m.basis, 200, ""),
      fail: str(m && m.fail, 140, ""),
      fallback: str(m && m.fallback, 200, ""),
    })),
    baseline: {
      desc: str(raw.baseline && raw.baseline.desc, 240, "基线：最可能、中间态、干得动"),
      act: str(raw.baseline && raw.baseline.act, 400, "先做基线动作。"),
    },
    shifting: arr(raw.shifting, 5).map((m) => ({
      when: str(m && m.when, 160, "外部变化"),
      change: str(m && m.change, 140, "变量状态变化"),
      act: str(m && m.act, 400, "换动作"),
    })),
    filters: arr(raw.filters, 6).map((m) => ({
      choice: str(m && m.choice, 100, "候选动作"),
      take: str(m && m.take, 8, "留"),
      reason: str(m && m.reason, 200, "依据"),
    })),
    riskline: arr(raw.riskline || raw.risk, 6).map((m) => ({
      name: str(m && m.name, 120, "边界"),
      risk: str(m && m.risk, 200, "风险"),
      patch: str(m && m.patch, 240, "补子动作"),
    })),
    redline: arr(raw.redline, 6).map((m) => ({
      name: str(m && m.name, 140, "反方角度"),
      point: str(m && (m.point || m.kind), 12, "链路"),
      patch: str(m && m.patch, 240, "修补"),
    })),
    prefs: arr(raw.prefs, 6).map((m) => ({
      name: str(m && m.name, 160, "偏好"),
      why: str(m && m.why, 200, ""),
    })),
    steps: arr(raw.steps, 8).map((m, i) => ({
      no: str(m && m.no, 6, String(i + 1)),
      act: str(m && m.act, 200, "完成一个可验证的动作。"),
    })),
    order: str(raw.order, 400, ""),
    motto: str(raw.motto, 120, "先动一步，再校验一步。"),
    qas: arr(raw.qas, 4)
      .map((x) => ({
        q: str(x && (x.q || x.question), 160, ""),
        answer: str(x && (x.answer || x.a), 340, ""),
      }))
      .filter((x) => x.q && x.answer),
  };
}

module.exports = { METHOD_SYSTEM_PROMPT, normalizeMethod };