// 分享落地页：只读快照（报告 = 金句 + 骨架卡 + 8 步全量；行动 = 方案 6 步）
const api = require("../../utils/api");

const ROOT_LABELS = {
  extraction: "提取-分配",
  delegation: "委托-执行",
  power: "权力竞争-均衡",
};

const STEP_LABELS = {
  materials: "材料与信源分级",
  anomaly: "异常锁定",
  skeleton: "中性骨架",
  mechanism: "机制穿透",
  game: "博弈与类比",
  scenario: "情景分支",
  judgment: "核心判断",
  adversarial: "对抗质检",
};

const SOURCE_GRADE_LABELS = {
  strong: "强",
  medium: "中",
  weak: "弱",
  unverifiable: "无法核实",
};

const BEDROCK_LABELS = {
  human_nature: "人性",
  incentive: "激励",
  power: "权力",
  information: "信息不对称",
  scarcity: "稀缺分配",
};

const ACTION_ORDER = ["pain", "triage", "selfDeception", "minimalAction", "crack", "placebo"];
const ACTION_LABELS = {
  pain: "痛点定位",
  triage: "可控性分诊",
  selfDeception: "自欺检测",
  minimalAction: "最小行动",
  crack: "缝隙扫描",
  placebo: "清醒安慰剂",
};

function buildActionSteps(plan) {
  const st = (plan && plan.steps) || {};
  const rows = [];
  const push = (key, text) => { if (text) rows.push({ key, no: ACTION_LABELS[key], label: ACTION_LABELS[key], summary: String(text) }); };
  if (st.pain) push("pain", st.pain.whatHurts || st.pain.signal || "");
  if (st.triage && st.triage.items) push("triage", (st.triage.items[0] && st.triage.items[0].text) || "");
  if (st.selfDeception) push("selfDeception", st.selfDeception.note || "");
  if (st.minimalAction && st.minimalAction.actions) push("minimalAction", (st.minimalAction.actions[0] && st.minimalAction.actions[0].title) || "");
  if (st.crack && st.crack.cracks) push("crack", (st.crack.cracks[0] && st.crack.cracks[0].kind) || "");
  if (st.placebo) push("placebo", (st.placebo.regulations && st.placebo.regulations[0]) || st.placebo.closingPrinciple || "");
  return rows;
}

// 把整份结构报告（8 步）抹成可读的 key-value，分享落地页完整回显，不再是只有一张卡
function buildMethodView(m) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    focus: (m && m.focus) || "",
    variables: arr(m && m.variables).map((v) => ({ name: v.name || "", tier: v.tier || "", note: v.note || "" })),
    map: arr(m && m.map).map((x) => ({ cond: x.cond || "", action: x.action || "", fail: x.fail || "", fallback: x.fallback || "" })),
    steps: arr(m && m.steps).map((st) => ({ no: st.no || "", act: st.act || "" })),
    order: (m && m.order) || "",
    motto: (m && m.motto) || "",
  };
}

function buildReportSteps(steps) {
  const out = [];
  (Array.isArray(steps) ? steps : []).forEach((step, i) => {
    const rows = [];
    const push = (k, v) => {
      if (v !== undefined && v !== null && String(v).trim()) rows.push({ k, v: String(v) });
    };
    switch (step.kind) {
      case "materials": {
        push("说明", step.note);
        (step.materials || []).forEach((m) => {
          const g = SOURCE_GRADE_LABELS[m.grade] || m.grade || "";
          push(g ? "证据「" + g + "」" : "证据", m.fact);
        });
        break;
      }
      case "anomaly": {
        push("预期基线", step.baseline);
        (step.candidates || []).forEach((c) => push("异常候选 " + (c.id || "") , c.content + (c.leverage ? "（杠杆 " + c.leverage + "）" : "")));
        push("选中说明", step.reason);
        break;
      }
      case "skeleton": {
        const sk = step.skeleton || {};
        push("主体", sk.subject);
        push("对象", sk.object);
        push("机制", sk.mechanism);
        push("受损方", sk.harmed);
        push("受益方", sk.benefited);
        push("中性命名", sk.naming);
        break;
      }
      case "mechanism": {
        const me = step.mechanism || {};
        push("锚定异常", me.anchorAnomaly);
        (me.layers || []).forEach((ly, li) => push("钻探" + (li + 1), ((ly.ask && ly.ask !== "—" ? ly.ask + " → " : "") + ly.finding + (ly.breakthrough ? "（" + ly.breakthrough + "）" : ""))));
        push("见底基岩", (BEDROCK_LABELS[me.bedrockKind] || me.bedrockKind) + "：" + me.bedrock);
        (me.interestFlow || []).forEach((t) => push("利益流动", t));
        push("重命名", me.renaming);
        (me.sideAnomalies || []).forEach((sa) => push("旁生异常", sa.any && sa.whyDig ? sa.anomaly + "（" + sa.whyDig + "）" : sa.anomaly));
        break;
      }
      case "game": {
        push("博弈均衡", (step.game || {}).gameSummary);
        push("胜负手", (step.game || {}).variableParameter);
        ((step.game || {}).analogs || []).forEach((a) => push("同构案例", a.title + (a.isomorphism ? "（" + a.isomorphism + "）" : "")));
        break;
      }
      case "scenario": {
        (step.variables || []).forEach((v) => push("关键变量", v));
        (step.branches || []).forEach((b) => {
          const prob = typeof b.probability === "number" ? b.probability + "%" : "";
          push("分支 " + (b.label || "") + " " + prob, b.narrative + (b.warningSignals ? "（预警：" + b.warningSignals + "）" : ""));
        });
        break;
      }
      case "judgment": {
        (step.judgments || []).forEach((j) => push("判断 · 置信 " + (typeof j.confidence === "number" ? j.confidence + "%" : "?"), j.claim + (j.falsifiable ? "\n可证伪：" + j.falsifiable : "")));
        break;
      }
      case "adversarial": {
        const c = step.check || {};
        (c.devilsAdvocate || []).forEach((d) => push("魔鬼代言人", d.challenge + (d.response ? "\n→ " + d.response : "")));
        (c.metacognition || []).forEach((mc) => push("元认知审计", mc.bias + (mc.check ? "：" + mc.check : "")));
        break;
      }
      default:
        break;
    }
    if (rows.some((r) => r.v)) {
      out.push({ no: i + 1, zh: STEP_LABELS[step.kind] || step.kind, kind: step.kind, rows });
    }
  });
  return out;
}

Page({
  data: {
    loading: true,
    share: null,
    ROOT_LABELS,
    ACTION_LABELS,
    actionSteps: [],
    reportSteps: [],
    isAction: false,
    isMethod: false,
    methodView: null,
  },

  onLoad(options) {
    const code = decodeURIComponent(options.code || "");
    if (!code) {
      this.setData({ loading: false });
      return;
    }
    api
      .getShare(code)
      .then((share) => {
        const isAction = share && share.type === "action";
        const isMethod = share && share.type === "method";
                const actionSteps = isAction ? buildActionSteps(share) : [];
        const reportSteps = isAction || isMethod ? [] : buildReportSteps(share && share.steps);
        const methodView = isMethod ? buildMethodView(share.steps) : null;
        this.setData({ share, loading: false, isAction, isMethod, actionSteps, reportSteps, methodView });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  onCopy() {
    const sh = this.data.share || {};
    const text = this.data.isAction
      ? ((sh.actionPlan && sh.actionPlan.headline) || sh.headline || "")
      : (sh.verdict || "");
    if (!text) return;
    wx.setClipboardData({ data: text });
  },

  onHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },

  onShareAppMessage() {
    const sh = this.data.share || {};
    const code = sh.code;
    const isAction = this.data.isAction;
    const title = isAction
      ? ((sh.actionPlan && sh.actionPlan.headline) || sh.headline || "解忧果 · 寻找缝隙")
      : (sh.type === "method" ? (sh.verdict || "解忧果 · 规划未来") : (sh.verdict || "解忧果 · 结构报告"));
    return {
      title,
      path: code ? "/pages/share/share?code=" + encodeURIComponent(code) + (isAction ? "&type=action" : "") : "/pages/home/home",
    };
  },
});
