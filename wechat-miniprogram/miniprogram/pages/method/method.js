// 规划未来：从「事件 + 结构分析 + 行动方案」算出一局具体怎么动（生成式）
// 支持：缓存秒开 / 重新计算 / 逐节追问（question 重算并带回 qas）/ 分享快照
const api = require("../../utils/api");
const shareImg = require("../../utils/share");
const local = require("../../utils/local");

const METHOD_STAGES = ["读取事件与行动方案", "规则推演当前打法", "生成条件应对表"];
const STAGE_STARTS = [0, 9, 22];
const STAGE_IDX = { reading: 0, generating: 1, parsing: 2 };
const EXPECTED_SECONDS = 40;

// 「?」注释内容（自己总结的方法论白话解释）
const METHOD_TIPS = {
  focus: { t: "这一局的局点", v: "一句话点明最关键的矛盾。后面所有条件、动作、滤网，都是从这个局点上长出来的。" },
  variables: { t: "决定成败的变量", v: "3~6 个最关键变量按硬/中/软分级：硬=一次变全局变，软=基本面，中=摇摆项；备注写怎么看它。" },
  map: { t: "条件 → 应对表", v: "核心是这张表：什么状态做什么、什么信号说明失效、失效后换什么动作。不追求「最对」，只追求有触发器。" },
  baseline: { t: "基线打法", v: "取「最可能、中间态、干得动」那条先走，先确认基线再谈变数。" },
  shifting: { t: "偏离与换轨", v: "每次只改一个变量，看局面偏移到哪、动作换成什么；一次动两个变量，出了问题说不清是谁导致。" },
  filters: { t: "三层滤网", v: "对每候选动作过三关：资源够不够（一票否决）、和真实状态匹不匹配、结果认不认。留和否都要给出理由。" },
  riskline: { t: "边界与风险", v: "把最怕翻车的地方写出来，每条配一个修补动作；看不见的边界往往最贵。" },
  redline: { t: "反方会怎么拆", v: "先站到最想反对你的人那边：前提破坏、链条中断、做成了也没用——每条都要能缝合才算过关。" },
  prefs: { t: "偏好落定", v: "把「我偏向什么」落到这一局的具体选项，避免一边嘴上坚持、一边手上随便。" },
  steps: { t: "落地步骤", v: "从今天就动的最小动作起，按顺序一步一步做；每一步都是对上一步的校验，做完再复盘。" },
  order: { t: "停手信号", v: "提前写死什么时候停下来核对、看哪几个信号；到点就停，别把一条路硬走到黑。" },
};

const SECT_TITLE = {
  variables: "关键变量",
  map: "条件应对表",
  baseline: "基线打法",
  shifting: "偏离路线",
  filters: "三层滤网",
  riskline: "边界与风险",
  redline: "反方拆解",
  prefs: "偏好落地",
  steps: "落地步骤",
  order: "停手核对",
};

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = function (n) { return n < 10 ? "0" + n : "" + n; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

Page({
  data: {
    id: "",
    loading: true,
    errorText: "",
    method: null,
    regenerating: false,
    stages: METHOD_STAGES,
    stageIndex: 0,
    progress: 0,
    elapsed: 0,
    etaSec: EXPECTED_SECONDS,
    generatedAtText: "",
    // ? 注释
    openTip: "",
    tipTitle: "",
    tipText: "",
    tipBubbleAbove: true,
    tipBubbleStyle: "",
    tipArrowX: 0,
    // 追问
    debateTarget: null,
    debateText: "",
    debatting: false,
    debateHint: "",
    debatePending: false,
    // 分享快照
    shareCode: "",
    shareImage: "",
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || "");
    if (!id) {
      this.setData({ loading: false, errorText: "缺少分析编号" });
      return;
    }
    this.setData({ id });
    this.enter(false);
  },

  onUnload() {
    this.stopTick();
  },

  // 进入 / 重新计算 / 重试统一入口
  enter(regenerate) {
    this.stopTick();
    this.setData({ loading: true, errorText: "", method: null, regenerating: !!regenerate });
    this.startTick();
    this.run(regenerate);
  },

  async run(regenerate) {
    const id = this.data.id;
    try {
      if (!regenerate) {
        const saved = await api.getSavedMethod(id);
        if (saved) {
          this.stopTick();
          this.applyMethod(saved);
          return;
        }
      }
      const plan = local.getLocalActionPlan(id) || (await api.getSavedActionPlan(id));
      if (!plan) {
        this.stopTick();
        this.setData({
          loading: false,
          errorText: "缺少行动方案：请先返回「寻找缝隙」页完成生成，再进这一层。",
        });
        return;
      }
      const analysis = local.getLocalAnalysis(id) || null;
      this._plan = plan;
      this._analysis = analysis;
      const payload = { id, plan, analysis };
      if (regenerate) payload.regenerate = true;
      await this.generate(payload);
    } catch (e) {
      this.failLoad(e);
    }
  },

  async generate(payload) {
    try {
      const method = await api.getMethodPlan(payload, (poll) => this.onProgress(poll));
      this.stopTick();
      this.applyMethod(method);
    } catch (e) {
      this.stopTick();
      this.failLoad(e);
    }
  },

  failLoad(e) {
    const raw = (e && e.message) || "生成失败";
    let errorText = raw;
    if (raw === "need_plan") errorText = "缺少行动方案：请先返回「寻找缝隙」页，完成方案后再进这一层。";
    else if (e && e.status === 408) errorText = "生成超时，请点重试。";
    this.setData({ loading: false, errorText, debatting: false });
  },

  applyMethod(method) {
    this.setData({
      method,
      loading: false,
      regenerating: false,
      errorText: "",
      debatting: false,
      debateTarget: null,
      generatedAtText: fmtTime(method && method.generatedAt),
    });
    this.prepareShare(method);
  },

  onProgress(poll) {
    if (!poll || poll.done) return;
    const idx = STAGE_IDX[poll.stage];
    const stageIndex = idx != null ? Math.max(this._stageMax || 0, idx) : (this._stageMax || 0);
    const progress = Math.max(this.data.progress || 0, Math.min(92, Math.round((poll.progress || 0) * 100)));
    this._stageMax = Math.max(this._stageMax || 0, stageIndex);
    this.setData({ stageIndex: this._stageMax, progress });
  },

  // 进度遮罩：乐观曲线 + 阶段异步进（阶段只前进，不回调）
  startTick() {
    if (this._tick) clearInterval(this._tick);
    this._startedAt = Date.now();
    this._stageMax = 0; // 阶段只前进（防真机回跳）
    this.setData({ elapsed: 0, progress: 0, stageIndex: 0, etaSec: EXPECTED_SECONDS });
    this._tick = setInterval(() => {
      const elapsed = (Date.now() - this._startedAt) / 1000;
      const progress = Math.min(92, Math.round((1 - Math.exp(-elapsed / (EXPECTED_SECONDS / 2.5))) * 100));
      let sIdx = 0;
      for (let i = 0; i < STAGE_STARTS.length; i++) {
        if (elapsed >= STAGE_STARTS[i]) sIdx = i;
      }
      sIdx = Math.max(this._stageMax || 0, sIdx);
      this._stageMax = sIdx;
      const etaSec = Math.max(5, Math.ceil(EXPECTED_SECONDS * (1 - progress / 100)));
      this.setData({ stageIndex: sIdx, progress, elapsed: Math.floor(elapsed), etaSec });
    }, 200);
  },

  stopTick() {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
  },

  recalc() {
    this.enter(true);
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.navigateTo({ url: "/pages/action/action?id=" + encodeURIComponent(this.data.id) });
  },

  // ---- 「?」注释（来自上面的 METHOD_TIPS）----
  toggleTip(e) {
    const key = (e.currentTarget.dataset.tip || "").trim();
    if (!key || this.data.openTip === key) {
      this.setData({ openTip: "" });
      return;
    }
    const info = METHOD_TIPS[key] || { t: key, v: "" };
    this.setData({ openTip: key, tipTitle: info.t, tipText: info.v });
    this.moveTipTo(key);
  },

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

  noop() {},

  // ---- 逐节追问 / 我不同意 ----
  openDebate(e) {
    if (this.data.debatting) return;
    const sec = e.currentTarget.dataset.sec || "";
    const label = e.currentTarget.dataset.label || "";
    this.setData({ debateTarget: { sec, label }, debateText: "" });
  },

  closeDebate() {
    this.setData({ debateTarget: null });
  },

  onDebateInput(e) {
    this.setData({ debateText: e.detail.value });
  },

  async submitDebate() {
    if (this.data.debatting) return;
    const text = (this.data.debateText || "").trim();
    if (!text) {
      wx.showToast({ title: "先写下你的反对或追问", icon: "none" });
      return;
    }
    const target = this.data.debateTarget || {};
    const label = SECT_TITLE[target.sec] || target.label || "";
    const question = (label ? "对「" + label + "」：" : "") + text;
    // 提交即关弹层：页面保持可浏览，右下角浮条显示重算中
    this.setData({ debateTarget: null, debateText: "", debatting: true, debateHint: "正在重算这一局… 约 30~60 秒", debatePending: true });
    const payload = {
      id: this.data.id,
      plan: this._plan || null,
      analysis: this._analysis || null,
      question,
      regenerate: true,
    };
    try {
      const method = await api.getMethodPlan(payload, (poll) => this.onDebateProgress(poll));
      this.applyMethod(method);
      wx.showToast({ title: "已按你的追问重算", icon: "none" });
    } catch (e) {
      api.apiErrorToast(e, "重算失败");
    } finally {
      this.setData({ debatting: false, debateHint: "", debatePending: false });
    }
  },

  // 弹窗内等待（与前两页追问一致，不再切全屏 loading）
  onDebateProgress(poll) {
    if (!poll || poll.done) return;
    const stage = poll.stage || "queued";
    const hint = {
      generating: "正在重打这一局… 约 30~60 秒",
      parsing: "正在整理结果…",
      saving: "快完成了…",
    }[stage];
    if (hint) this.setData({ debateHint: hint });
  },

  // ---- 分享 ----
  prepareShare(method) {
    if (!method || this._shareGenDoneAt === method.generatedAt) return;
    this._shareGenDoneAt = method.generatedAt;
    const blocks = [];
    if (method.variables && method.variables.length) {
      blocks.push({ k: "关键变量", v: method.variables.slice(0, 3).map(function (v) { return v.name; }).join(" / ") });
    }
    const firstStep = method.steps && method.steps[0];
    if (firstStep) blocks.push({ k: "今天先动", v: firstStep.act });
    if (method.motto) blocks.push({ k: "金句", v: String(method.motto).slice(0, 50) });
    shareImg
      .makeShareImage(this, "method-share-canvas", {
        kicker: "解忧果 · 规划未来",
        title: method.focus || "",
        blocks: blocks.slice(0, 3),
        footer: "点开解忧果，把卡住的事照一照",
      })
      .then(function (path) { if (path) this.setData({ shareImage: path }); }.bind(this))
      .catch(function () {});
    api
      .createShare({ type: "method", method })
      .then(function (code) { if (code) this.setData({ shareCode: code }); }.bind(this))
      .catch(function () {});
  },

  onShareAppMessage() {
    const m = this.data.method || {};
    const title = m.focus ? "解忧果 · 规划未来：" + String(m.focus).slice(0, 40) : "解忧果 · 规划未来";
    const payload = {
      title,
      path: this.data.shareCode
        ? "/pages/share/share?code=" + encodeURIComponent(this.data.shareCode)
        : "/pages/method/method?id=" + encodeURIComponent(this.data.id),
    };
    if (this.data.shareImage) payload.imageUrl = this.data.shareImage;
    return payload;
  },
});
