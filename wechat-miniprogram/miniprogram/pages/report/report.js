// 报告页：8 步结构报告 + 骨架卡 + 人机辩论 + 钻探 + 行动方案/分享入口
const api = require("../../utils/api");
const local = require("../../utils/local");
const shareImg = require("../../utils/share");
const autoSync = require("../../utils/auto-sync");

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

// 每节「?」注释：忠实参考原作 i18n（pipeline.tips），口径一致
const SKEL_TIP =
  "把本次分析提炼出的底层结构沉淀成一张可迁移的卡片，随同构实例的不断出现，从「假设」逐步点亮为「已验证」。";

const VERDICT_TIP =
  "这是穿透整张报告后挤出的那一句核心判断。它必须经得住 8 步推演，也接受你随时点「我不同意」来挑战它。";

const STEP_TIPS = {
  materials:
    "先把分析所依据的事实逐条列出，并标注可信度（强 / 中 / 弱 / 无法核实）；搜不到就说不搜不到，绝不假装知道。",
  anomaly:
    "找出最「不对劲」、解释力最强的异常点作为切入口——异常往往是结构的裂缝。",
  skeleton:
    "剥离情绪与立场，把事件还原成主体 / 对象 / 机制 / 受损方 / 受益方等中性要素。",
  mechanism:
    "沿表面 → 深层 → 底层一层层往下挖因果链，直到摸到可以跨领域迁移的核心机制，并理清利益流向。",
  game:
    "推演各方博弈会落在什么均衡，再找跨领域的同构案例来验证这个结构。",
  scenario:
    "列出关键变量与几种可能的走向，给出各自概率与可观察的预警信号。",
  judgment:
    "这里是整份报告的核心结论，每条都附「可证伪条件」——出现什么就说明这条判断错了。",
  adversarial:
    "站在反方的最强立场自我攻击（魔鬼代言人），并审计自己可能中了哪些系统性偏差。",
};

// 轻重表达：核心步骤带角标/高亮，辅助步骤弱化
const STEP_TAGS = {
  materials: { tag: "事实底料", tagClass: "badge-info" },
  anomaly: { tag: "关键切入口", tagClass: "badge-strong" },
  skeleton: { tag: "中性骨架", tagClass: "badge-strong" },
  mechanism: { tag: "核心机制", tagClass: "badge-strong" },
  game: { tag: "博弈辅助", tagClass: "badge-warn" },
  scenario: { tag: "情景推演", tagClass: "badge-warn" },
  judgment: { tag: "核心结论", tagClass: "badge-strong" },
  adversarial: { tag: "质检关卡", tagClass: "badge-danger" },
};
const KEY_STEP_KINDS = ["mechanism", "judgment"];

const ROOT_LABELS = {
  extraction: "提取-分配",
  delegation: "委托-执行",
  power: "权力竞争-均衡",
};

const SOURCE_GRADE_LABELS = {
  strong: "强",
  medium: "中",
  weak: "弱",
  unverifiable: "无法核实",
};

const STANCE_LABELS = {
  absorb: "吸收调整",
  compromise: "折中处理",
  hold: "保持不变",
};

const BEDROCK_LABELS = {
  human_nature: "人性",
  incentive: "激励",
  power: "权力",
  information: "信息不对称",
  scarcity: "稀缺分配",
};

const SOURCE_GRADE_CLASS = {
  strong: "badge-ok",
  medium: "badge-info",
  weak: "badge-warn",
  unverifiable: "badge-danger",
};

const STANCE_CLASS = {
  absorb: "badge-ok",
  compromise: "badge-warn",
  hold: "badge-info",
};

function zh(stepKind) {
  return STEP_LABELS[stepKind] || stepKind;
}

// 为每步选一个适合钻探的默认点（当用户直接点钻探时先用这个）
function pickDrillDefault(step) {
  switch (step.kind) {
    case "materials":
      return step.materials && step.materials[0] ? step.materials[0].fact : "";
    case "anomaly": {
      const sel = (step.candidates || []).find((c) => c.id === step.selectedId);
      return sel ? sel.content : (step.candidates && step.candidates[0] ? step.candidates[0].content : "");
    }
    case "mechanism":
      return step.mechanism && step.mechanism.bedrock ? step.mechanism.bedrock : "";
    case "judgment":
      return step.judgments && step.judgments[0] ? step.judgments[0].claim : "";
    case "adversarial":
      return step.check && step.check.devilsAdvocate && step.check.devilsAdvocate[0]
        ? step.check.devilsAdvocate[0].challenge : "";
    case "game":
      return step.game && step.game.gameSummary ? step.game.gameSummary : "";
    case "scenario":
      return step.branches && step.branches[0] ? step.branches[0].narrative : "";
    case "skeleton":
      return step.skeletonStep ? step.skeletonStep.naming : "";
    default:
      return "";
  }
}

Page({
  data: {
    result: null,
    id: "",
    loading: true, // 整屏暗色 loading：承接首页「照一照」遮罩，切换不闪白
    verdict: "",
    skeleton: null,
    question: "",
    steps: [], // 渲染用 [{kind,label,index,open,collapse, body...}]
    SKEL_TIP,
    VERDICT_TIP,
    STEP_TIPS,
    openTip: "",
    tipTitle: "",
    tipText: "",
    actionDirty: false,
    // 标签映射（供 WXML 使用）
    STEP_LABELS,
    ROOT_LABELS,
    SOURCE_GRADE_LABELS,
    STANCE_LABELS,
    BEDROCK_LABELS,
    SOURCE_GRADE_CLASS,
    STANCE_CLASS,
    version: "",
    createdAt: "",
    // 辩论会话
    debateTarget: null, // {type:'skeleton'|'step', index}
    debateText: "",
    debatting: false,
    // 钻探会话
    drillTarget: null, // {stepIndex, point, layerTitle, verdict}
    drillMode: "challenge",
    drillText: "",
    drilling: false,
    drillResult: "",
    // 分享小卡：离屏生成的金句图 + 公开短码
    shareImage: "",
    shareCode: "",
    // "?" 注释：锚定在问号附近
    tipBubbleStyle: "",
    tipBubbleAbove: false,
    tipArrowX: 0,
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || "");
    this.setData({ id, loading: true });
    let result = local.getLocalAnalysis(id);
    if (result) {
      this.bindResult(result);
    } else {
      // 云端回读
      api
        .getAnalysis(id)
        .then((r) => {
          if (r) {
            local.saveLocalAnalysis(r);
            this.bindResult(r);
          } else {
            this.setData({ loading: false });
            wx.showToast({ title: "未找到该分析", icon: "none" });
            setTimeout(() => wx.navigateBack(), 1200);
          }
        })
        .catch((e) => {
          this.setData({ loading: false });
          api.apiErrorToast(e, "读取失败");
        });
    }
  },

  // 把一个完整 result 解析成分步渲染结构
  bindResult(result) {
    const steps = (result.steps || []).map((step, i) => {
      const base = {
        index: i,
        kind: step.kind,
        label: step.title || STEP_LABELS[step.kind],
        zh: STEP_LABELS[step.kind] || step.kind,
        open: true, // v1.6 默认全部展开
        drillDefault: pickDrillDefault(step),
        tag: STEP_TAGS[step.kind] ? STEP_TAGS[step.kind].tag : "",
        tagClass: STEP_TAGS[step.kind] ? STEP_TAGS[step.kind].tagClass : "",
        key: KEY_STEP_KINDS.indexOf(step.kind) >= 0,
        meta: {
          debate: step.debate || [],
          overlays: step.overlays || [],
        },
      };
      // 按 kind 提取渲染字段
      if (step.kind === "materials") {
        base.materials = step.materials || [];
        base.note = step.note || "";
      } else if (step.kind === "anomaly") {
        base.baseline = step.baseline || "";
        base.candidates = step.candidates || [];
        base.selectedId = step.selectedId || "";
        base.reason = step.reason || "";
      } else if (step.kind === "skeleton") {
        base.skeletonStep = step.skeleton;
      } else if (step.kind === "mechanism") {
        base.mechanism = step.mechanism;
      } else if (step.kind === "game") {
        base.game = step.game;
      } else if (step.kind === "scenario") {
        base.variables = step.variables || [];
        base.branches = step.branches || [];
      } else if (step.kind === "judgment") {
        base.judgments = step.judgments || [];
      } else if (step.kind === "adversarial") {
        base.check = step.check;
      }
      return base;
    });

    const skRaw = result.skeleton || {};
    const skStep = steps.find((s) => s.kind === "skeleton");
    const skBody = (skStep && skStep.skeletonStep) || {};
    const skeleton = {
      name: skRaw.name || skBody.naming || "",
      perceivedAs: skRaw.perceivedAs || skBody.perceivedAs || "",
      actualStructure: skRaw.actualStructure || skBody.actualStructure || "",
      whySo: skRaw.whySo || skBody.whySo || "",
      root: skRaw.root || skBody.root || "",
      confidence: skRaw.confidence || skBody.confidence || 0,
      parts: skRaw.parts || [],
      altStructure: skRaw.altStructure || skBody.altStructure || "",
      debate: skRaw.debate || [],
    };

    this.setData({
      result,
      steps,
      verdict: result.verdict,
      skeleton,
      question: result.input || "",
      version: result.version,
      createdAt: result.createdAt,
    });
    this.setData({ loading: false });
    this.prepareShare();
  },

  toggleStep(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `steps[${idx}].open`;
    this.setData({ [key]: !this.data.steps[idx].open });
  },

  // 「?」注释：点开后锚定在问号附近展示，点空白/「知道了」关闭
  toggleTip(e) {
    const tip = e.currentTarget.dataset.tip;
    if (!tip || this.data.openTip === tip) {
      this.setData({ openTip: "" });
      return;
    }
    let tipTitle = "";
    let tipText = "";
    if (tip === "verdict") {
      tipTitle = "一句金句结论";
      tipText = VERDICT_TIP;
    } else if (tip === "skeleton") {
      tipTitle = "结构骨架卡";
      tipText = SKEL_TIP;
    } else {
      tipTitle = STEP_LABELS[tip] || tip;
      tipText = STEP_TIPS[tip] || "";
    }
    this.setData({ openTip: tip, tipTitle, tipText });
    this.moveTipTo(tip);
  },
  // 计算气泡位置：优先放问号上方，空间不够放下方；箭头指向问号
  moveTipTo(tip) {
    wx.createSelectorQuery()
      .in(this)
      .select("#tip-" + tip)
      .boundingClientRect((rect) => {
        if (!rect) return;
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const vw = win.windowWidth;
        const vh = win.windowHeight;
        const bubbleW = Math.min(vw * 0.82, (660 * vw) / 750);
        let left = rect.left + rect.width / 2 - bubbleW / 2;
        left = Math.max(10, Math.min(left, vw - bubbleW - 10));
        const arrowX = Math.max(10, Math.min(rect.left + rect.width / 2 - left, bubbleW - 20));
        const above = rect.top > 340;
        const style = above
          ? "left:" + left + "px;bottom:" + (vh - rect.top + 16) + "px;"
          : "left:" + left + "px;top:" + (rect.bottom + 16) + "px;";
        this.setData({ tipBubbleAbove: above, tipBubbleStyle: style, tipArrowX: arrowX });
      })
      .exec();
  },
  closeTip() {
    this.setData({ openTip: "" });
  },

  // ---- 分享小卡：金句图 + 公开短码（弱网失败不阻塞） ----
  prepareShare() {
    const r = this.data.result;
    if (!r || this._sharePrepared) return;
    this._sharePrepared = true;
    const blocks = [];
    if (r.skeleton) {
      blocks.push({ k: "结构", v: r.skeleton.name || "" });
      if (r.skeleton.actualStructure) blocks.push({ k: "真实运作是", v: r.skeleton.actualStructure });
    }
    const judgmentStep = (r.steps || []).find((s2) => s2.kind === "judgment");
    const firstJudgment = judgmentStep && judgmentStep.judgments && judgmentStep.judgments[0];
    if (firstJudgment) blocks.push({ k: "核心判断", v: firstJudgment.claim });
    if (r.skeleton && r.skeleton.whySo && blocks.length < 3) blocks.push({ k: "为什么", v: r.skeleton.whySo });
    shareImg
      .makeShareImage(this, "share-canvas", {
        kicker: "解忧果 · 结构报告",
        title: r.verdict || "",
        blocks,
        footer: "打开解忧果，把你的困惑也照一照",
      })
      .then((path) => path && this.setData({ shareImage: path }))
      .catch(() => {});
    api
      .createShare({ input: r.input, verdict: r.verdict, skeleton: r.skeleton, steps: r.steps || [] })
      .then((code) => code && this.setData({ shareCode: code }))
      .catch(() => {});
  },

  // ---- 骨架卡辩论 ----
  onSkeletonDebate() {
    this.setData({ debateTarget: { type: "skeleton" }, debateText: "" });
  },
  openStepDebate(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ debateTarget: { type: "step", index: idx }, debateText: "" });
  },
  onCloseDebate() {
    this.setData({ debateTarget: null, debateText: "" });
  },
  onDebateInput(e) {
    this.setData({ debateText: e.detail.value });
  },
  // 弹层内部点击用 catchtap 阻止冒泡，避免点到输入框/提交时误触 mask 把弹框关掉
  noop() {},
  async onSubmitDebate() {
    if (this.data.debatting) return;
    const { debateTarget, debateText, result } = this.data;
    const disagreement = (debateText || "").trim();
    if (!disagreement) {
      wx.showToast({ title: "先写下你的反对或追问", icon: "none" });
      return;
    }
    const fromStepKind =
      debateTarget.type === "skeleton" ? "skeleton-card" : this.data.steps[debateTarget.index].kind;
    this.setData({ debatting: true });
    try {
      const res = await api.recompute({
        result,
        fromStepKind,
        disagreement,
      });
      // 用返回的 result 原地更新
      local.saveLocalAnalysis(res.result);
      autoSync.sync(); // 追问重算后自动同步
      // 结构变了，行动方案的本地记忆作废，重新生成
      local.clearLocalActionPlan(this.data.id);
      local.clearLocalPlanState(this.data.id);
      this.bindResult(res.result);
      this.setData({ debateTarget: null, debateText: "", actionDirty: true });
      wx.showToast({ title: "已更新" + (res.changeNote ? `：${res.changeNote}` : ""), icon: "none" });
    } catch (e) {
      api.apiErrorToast(e, "重算失败");
    } finally {
      this.setData({ debatting: false });
    }
  },

  // ---- 钻探 ----
  openDrill(e) {
    const { index, point, title } = e.currentTarget.dataset;
    const step = this.data.steps[index];
    this.setData({
      drillTarget: { index, point, title: title || step.label, kind: step.kind },
      drillText: point || "",
      drillMode: "counter",
      drillResult: "",
    });
  },
  onCloseDrill() {
    this.setData({ drillTarget: null, drillResult: "" });
  },
  onDrillMode(e) {
    this.setData({ drillMode: e.currentTarget.dataset.mode });
  },
  onDrillInput(e) {
    this.setData({ drillText: e.detail.value });
  },
  async onRunDrill() {
    const { drillTarget, drillText, drillMode } = this.data;
    if (!drillText.trim()) {
      wx.showToast({ title: "钻探点不为空", icon: "none" });
      return;
    }
    wx.showLoading({ title: "钻探中…", mask: true });
    try {
      const text = await api.drill({
        verdict: drillTarget.kind,
        layerTitle: drillTarget.title,
        point: drillText.trim(),
        mode: drillMode,
      });
      this.setData({ drillResult: text });
    } catch (e) {
      api.apiErrorToast(e, "钻探失败");
    } finally {
      wx.hideLoading();
    }
  },
  // 把钻探结果插入对应步骤下方（作为该步的 drillNote）
  async onApplyDrill() {
    const { drillTarget, drillResult } = this.data;
    if (!drillResult) return;
    const idx = drillTarget.index;
    const step = this.data.steps[idx];
    const existing = step.drillNotes || [];
    this.setData({
      [`steps[${idx}].drillNotes`]: [...existing, { text: drillResult }],
      drillTarget: null,
      drillResult: "",
    });
  },

  // ---- 底部入口 ----
  onGoAction() {
    // fresh=1 表示报告刚被追问重算，行动方案需要重新生成（本地记忆只在结构未变时命中）
    const fresh = this.data.actionDirty ? "1" : "0";
    wx.navigateTo({ url: `/pages/action/action?id=${encodeURIComponent(this.data.id)}&fresh=${fresh}` });
  },
  onShareAppMessage() {
    const r = this.data.result;
    const payload = {
      title: r ? r.verdict : "解忧果 · 结构分析",
      path: this.data.shareCode
        ? "/pages/share/share?code=" + encodeURIComponent(this.data.shareCode)
        : "/pages/report/report?id=" + encodeURIComponent(this.data.id),
    };
    if (this.data.shareImage) payload.imageUrl = this.data.shareImage;
    return payload;
  },
});
