// 行动方案页：五模块推演（锚定/侦察/试探/归口/收尾）+ 六步行动 + 视角切换 + 局部重算
const api = require("../../utils/api");
const shareImg = require("../../utils/share");
const local = require("../../utils/local");
const autoSync = require("../../utils/auto-sync");

// ===== 六步行动（step keys & 后端局部重算 fromStepKey）=====
const STEP_ORDER = ["pain", "triage", "selfDeception", "minimalAction", "crack", "placebo"];
const STEP_NUMBERS = { pain: "1", triage: "2", selfDeception: "3", minimalAction: "4", crack: "5", placebo: "6" };
const STEPS_OPEN = STEP_ORDER.reduce((m, k) => (m[k] = true, m), {});
const STEP_LABELS = {
  pain: "痛点定位",
  triage: "可控性分诊",
  selfDeception: "自欺检测",
  minimalAction: "最小行动",
  crack: "缝隙扫描",
  placebo: "清醒安慰剂",
};

const ACTION_TIPS = {
  overview:
    "「清醒行动主义」是一套在刚性结构中清醒生活的行动手册：不美化痛苦、不灌鸡汤——能改的去改，改不了的学会不骗自己地调节。它接在结构分析之后，把「看清」变成「可动」。",
  pain: "把情绪痛还原成一个冷静的信号：是身体的生物警报（怕、累、被威胁），还是被某个刚性结构挤压的结构信号。先看清真正在痛什么。",
  triage: "把这件事拆开逐条归入三筐：能改的去动它；暂时动不了的诚实归筐、只给调节。可控/不可控是试探后的结果，不是先验断言。",
  selfDeception: "区分「能动而不动」和「真的动不了」：前者要温和点破，后者要共情而不催促。伦理闸门一旦搞错，整套建议就变冷血。",
  minimalAction: "只对「能改」的部分，给今天或本周就能起步、5 分钟可开始、可迭代的最小试探。行动产生反馈，反馈打破自欺。",
  crack: "针对暂时动不了的结构，找现实缝隙：规则不一致、监管空白、利益裂痕、新技术新空间。只从「落差坐标」推导缝隙。",
  placebo: "只对「确实改不了」的部分，给不自欺的调节法（生理优先、观察者练习、限定反刍时间）。它是止痛，不是治本，别当真理。",
};
// ===== 五模块（v3 架构）=====
const MODULE_ORDER = ["anchor", "recon", "probe", "pivot", "closure"];
const MODULE_META = {
  anchor: { num: "M1", title: "心理锚定", slogan: "先稳心", legacyKey: "pain" },
  recon: { num: "M2", title: "缝隙侦察", slogan: "先找缝", legacyKey: "crack" },
  probe: { num: "M3", title: "最小试探", slogan: "再行动", legacyKey: "minimalAction" },
  pivot: { num: "M4", title: "动态归口", slogan: "可重判", legacyKey: "triage" },
  closure: { num: "M5", title: "收束复盘", slogan: "有边界", legacyKey: "placebo" },
};
const MODULE_TAGS = {
  anchor: { tag: "先认清神", tagClass: "badge-strong" },
  recon: { tag: "找缝", tagClass: "badge-info" },
  probe: { tag: "今天就动", tagClass: "badge-strong" },
  pivot: { tag: "诚实归筐", tagClass: "badge-warn" },
  closure: { tag: "带边界", tagClass: "badge-danger" },
};
const MODULE_TIPS = {
  anchor: "心理锚定 = 祛魅 + 承认 + 分级 + 诚实调节的整套基础：先看清自己被喂了什么安慰剂、这一刻到底是什么在痛，才谈得上行动。",
  recon: "缝隙 = 「原本以为是 vs 真实运作」的落差坐标 + 每周主动扫描的雷达。先找缝，才有地方动；缝有生命周期，会过期也会关闭。",
  probe: "最小试探 = 一条只试「能改」的小步，自带时间盒、停手线、可观察的成功标志。试完回填，行动才有反馈。",
  pivot: "可控 / 不可控不是先验分类，是试探后的结论：没把握的先进「待试」，有把握的按真实反应归筐；归错筐可以改，改判本身就是新反馈。",
  closure: "该停手就停手（停手线），每周回看一次（复盘），毕业前把四问过一遍——这是行动的边界，不是行动的死刑。",
};

const WEEK_INDICATORS = [
  "试行 / 暂定 / 新旧并存的地方",
  "监管成本高、执法不均衡的地带",
  "新技术先跑、规则滞后",
  "信息门槛高、不对称明显",
  "利益方内斗 / 试点出不了定论",
];
const WEEK_CHANNELS = [
  { t: "政策 30 分钟", d: "翻相关目录的「暂行、试行」字眼，记下窗口期" },
  { t: "技术 15 分钟", d: "看新工具 / 新平台的上线说明与改版公告" },
  { t: "行业互动 1 小时", d: "和一线的人聊，找「心知肚明却不写明」的缝隙" },
  { t: "个人回顾", d: "记这周在哪件事上觉得「有劲使不上」" },
];

const FOUR_QUESTIONS = [
  { key: "painDown", q: "这个痛，已经降了一级吗？" },
  { key: "gapGone", q: "缝隙已经过去（或确认不存在）？" },
  { key: "feedback", q: "试探的反馈已经内化进判断？" },
  { key: "leave", q: "你可以不带新包袱地离开？" },
];

const PROBE_STATUS_LABELS = { todo: "待试", running: "在试", verified: "已做", done: "暂时收手" };
const PROBE_STATUS_ORDER = ["todo", "running", "verified", "done"];
const CRACK_STATUS_LABELS = { unchecked: "未验证", probing: "试探中", verified: "已验证", closed: "已关闭" };
const COST_LABELS = { low: "低", mid: "中", high: "高" };
const LEVEL_LABELS = { "1": "1级·生命级", "2": "2级·大损伤", "3": "3级·高压力", "4": "4级·一般困扰", "5": "5级·轻微" };

const BUCKET_META = {
  canLeave: { label: "能换处境", desc: "换位置 / 换规则 / 换对象", cls: "badge-ok" },
  canChange: { label: "能改自身做法", desc: "换做法 / 换习惯 / 换认知", cls: "badge-info" },
  cannotNow: { label: "现在改不了", desc: "只能调节 + 等窗口", cls: "badge-danger" },
};
const BUCKET_KEYS = ["canLeave", "canChange", "cannotNow"];

const BUCKET_LABELS = { environment: "可改环境", behavior: "可改自身", uncontrollable: "动不了，只能调节" };
const SELF_VERDICT_LABELS = { able_but_idle: "能动而不动", truly_unable: "真的无法行动", unclear: "很难判定" };
const STANCE_LABELS = { absorb: "吸收调整", compromise: "折中处理", hold: "保持不变" };
const STANCE_CLASS = { absorb: "badge-ok", compromise: "badge-warn", hold: "badge-info" };

const ACTION_LOADING_STAGES = ["先摸清你此刻的辩", "先找一条能看到出口的缝", "把能改的与动不了的先拆开", "给最小试探设好时间盒与停手线", "留几句收尾：何时停、怎么复盘"];
const PLACEBO_STAGE_STARTS = [0, 4, 8, 12, 16]; // 5 行阶段各自可点亮
const PLACEBO_EXPECTED_SECONDS = 20;

function tipFor(tip) {
  if (tip === "overview") return { t: "清醒行动主义 · 行动方案", v: ACTION_TIPS.overview };
  const m = MODULE_ORDER.find((k) => "m-" + k === tip);
  if (m) return { t: MODULE_META[m].title, v: MODULE_TIPS[m] };
  return { t: STEP_LABELS[tip] || tip, v: ACTION_TIPS[tip] || "" };
}

Page({
  data: {
    id: "",
    plan: null,
    analysis: null,
    loading: true,
    generating: false,
    viewMode: "legacy", // 默认展示六步行动；legacy=六步行动 / full=五模块推演
    MODULE_ORDER,
    MODULE_META,
    MODULE_TAGS,
    WEEK_INDICATORS,
    WEEK_CHANNELS,
    FOUR_QUESTIONS,
    PROBE_STATUS_LABELS,
    CRACK_STATUS_LABELS,
    COST_LABELS,
    LEVEL_LABELS,
    BUCKET_KEYS,
    BUCKET_META,
    BUCKET_LABELS,
    modulesView: null,
    // 六步行动
    STEP_ORDER,
    STEP_LABELS,
    STEP_NUMBERS,
    stepsOpen: STEPS_OPEN,
    ACTION_TIPS,
    SELF_VERDICT_LABELS,
    STANCE_LABELS,
    STANCE_CLASS,
    // 遮罩加载
    stages: ACTION_LOADING_STAGES,
    stageIndex: 0,
    progress: 0,
    elapsed: 0,
    etaSec: PLACEBO_EXPECTED_SECONDS,
    // 交互
    openTip: "",
    tipTitle: "",
    tipText: "",
    tipBubbleStyle: "",
    tipBubbleAbove: false,
    tipArrowX: 0,
    debateKey: "",
    debateText: "",
    debateTitle: "",
    debatting: false,
    debateHint: "",
    debatePending: false,
    changeNote: "",
    // 分享态
    shared: false,
    shareCode: "",
    shareImage: "",
  },

  onLoad(options) {
    if (options.share === "1" && options.code) {
      this.stopTick();
      this.loadSharedPlan(decodeURIComponent(options.code));
      return;
    }
    const id = decodeURIComponent(options.id || "");
    const fresh = options.fresh === "1";
    this.setData({ id, fresh });
    const analysis = local.getLocalAnalysis(id);
    this.setData({ analysis });
    this.startTick();
    this.initPlan(id, analysis, fresh);
  },

  async loadSharedPlan(code) {
    try {
      const share = await api.getShare(code);
      if (share && share.type === "action" && share.actionPlan) {
        this.setData({ shared: true });
        this.applyPlan(share.actionPlan);
        return;
      }
    } catch (e) { /* fallthrough */ }
    this.setData({ loading: false, shared: true });
    wx.showToast({ title: "分享内容不存在", icon: "none" });
  },

  // 遮罩
  startTick() {
    if (this._tick) clearInterval(this._tick);
    this._startedAt = Date.now();
    this._stageMax = 0; // 阶段只前进（防真机回跳）
    this.setData({ elapsed: 0, progress: 0, stageIndex: 0, etaSec: PLACEBO_EXPECTED_SECONDS });
    this._tick = setInterval(() => {
      const elapsed = (Date.now() - this._startedAt) / 1000;
      const progress = Math.min(92, Math.round((1 - Math.exp(-elapsed / (PLACEBO_EXPECTED_SECONDS / 2.5))) * 100));
      let stageIndex = 0;
      for (let i = 0; i < PLACEBO_STAGE_STARTS.length; i++) {
        if (elapsed >= PLACEBO_STAGE_STARTS[i]) stageIndex = i;
      }
      stageIndex = Math.max(this._stageMax || 0, stageIndex);
      this._stageMax = stageIndex;
      const etaSec = Math.max(5, Math.ceil(PLACEBO_EXPECTED_SECONDS * (1 - progress / 100)));
      this.setData({ stageIndex, progress, elapsed: Math.floor(elapsed), etaSec });
    }, 200);
  },
  stopTick() {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  },

  // 「?」注释
  toggleTip(e) {
    const tip = (e.currentTarget.dataset.tip || "").trim();
    if (!tip || this.data.openTip === tip) { this.setData({ openTip: "" }); return; }
    const info = tipFor(tip);
    this.setData({ openTip: tip, tipTitle: info.t, tipText: info.v });
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
  closeTip() { this.setData({ openTip: "" }); },

  // 进入「复杂局」行动推演页
  goMethod() {
    const id = (this.data.plan && this.data.plan.id) || this.data.id || "";
    if (!id) {
      wx.showToast({ title: "缺少分析编号", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/method/method?id=" + encodeURIComponent(id) });
  },

  async initPlan(id, analysis, fresh) {
    try {
      if (!fresh) {
        const cached = local.getLocalActionPlan(id);
        if (cached) { this.stopTick(); this.applyPlan(cached); return; }
      }
      const saved = await api.getSavedActionPlan(id);
      if (saved && !fresh) {
        this.stopTick();
        this.applyPlan(saved);
        local.saveLocalActionPlan(id, saved);
        return;
      }
      if (!analysis) {
        this.stopTick();
        this.setData({ loading: false });
        wx.showToast({ title: "缺少分析数据", icon: "none" });
        return;
      }
      await this.generatePlan(id, analysis, true);
    } catch (e) {
      this.stopTick();
      api.apiErrorToast(e, "读取行动方案失败");
      this.setData({ loading: false });
    }
  },

  async generatePlan(id, analysis, silent) {
    if (!silent) this.startTick();
    this.setData({ generating: true });
    try {
      const plan = await api.getActionPlan(
        {
          id,
          input: analysis.input,
          verdict: analysis.verdict,
          skeleton: analysis.skeleton,
          ...(this.data.fresh ? { regenerate: true } : {}),
        },
        (poll) => this.onActionProgress(poll),
      );
      this.stopTick();
      local.saveLocalActionPlan(id, plan);
      this.applyPlan(plan);
      this.clearReportDirtyFlag();
      autoSync.sync(); // 生成后自动同步
    } catch (e) {
      this.stopTick();
      this.setData({ generating: false, loading: false });
      api.apiErrorToast(e, "生成行动方案失败");
    }
  },

  onSwitchPerspective(e) {
    const label = e.currentTarget.dataset.label;
    const idx = e.currentTarget.dataset.idx;
    const cur = this.data.plan && this.data.plan.perspectiveOptions && this.data.plan.perspectiveOptions[idx];
    if (!cur || (this.data.plan.perspective && cur.label === this.data.plan.perspective.label)) return;
    wx.showLoading({ title: "切换视角…", mask: true });
    api.getActionPlan({
      id: this.data.id,
      input: this.data.analysis.input,
      verdict: this.data.analysis.verdict,
      skeleton: this.data.analysis.skeleton,
      regenerate: true,
      perspectiveLabel: label,
    }).then((plan) => {
      this.applyPlan(plan);
      local.saveLocalActionPlan(this.data.id, plan);
      this.clearReportDirtyFlag();
      autoSync.sync();
    }).catch((err) => {
      api.apiErrorToast(err, "切换视角失败");
    }).finally(() => wx.hideLoading());
  },

  // 六步行动 / 五模块推演
  switchView(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.viewMode) return;
    this.setData({ viewMode: mode });
  },

  // 核心：把一份 plan 落到页面（同时构建五模块视图，旧数据自动回退六步速览）
  applyPlan(plan) {
    if (!plan) return;
    const hasModules = !!(plan.modules && plan.modules.anchor && plan.modules.recon);
    const preferred = this.data.viewMode;
    const viewMode = hasModules ? (preferred === "legacy" ? "legacy" : "full") : "legacy";
    const modulesView = hasModules ? this.buildModulesView(plan) : null;
    this.setData({ plan, loading: false, generating: false, viewMode, modulesView });
    this.prepareShare();
  },

  // 本地交互态（扫缝勾选 / 探针状态&笔记 / 四问 / 归筐改判）
  buildModulesView(plan) {
    const m = plan.modules || {};
    const state = local.getLocalPlanState(this.data.id) || {};
    const scan = Array.isArray(state.scan) ? state.scan : [];
    const probeState = state.probe && typeof state.probe === "object" ? state.probe : {};
    const four = state.four && typeof state.four === "object" ? state.four : {};
    const pivotMap = state.pivot && typeof state.pivot === "object" ? state.pivot : {};

    const a = m.anchor || {};
    const dis = a.disenchant || {};
    const agent = a.agentVerdict || {};
    const degree = a.degree || {};
    const calmRows = Array.isArray(a.calm && a.calm.ways) ? a.calm.ways : [];
    const anchor = {
      comfortType: dis.comfortType || "",
      protective: dis.protective || "",
      price: dis.price || "",
      signal: dis.signal || "",
      verdict: agent.verdict || "unclear",
      note: agent.note || "",
      level: degree.level || "3",
      whatHurts: degree.whatHurts || "",
      calmRows,
    };

    const r = m.recon || {};
    const cracks = (Array.isArray(r.passiveCracks) ? r.passiveCracks : []).map((c) => ({
      kind: c.kind || "",
      gap: c.gap || "",
      enter: c.enter || "",
      shut: c.shut || "",
      status: CRACK_STATUS_LABELS[c.status] ? c.status : "unchecked",
      cost: COST_LABELS[c.cost] ? c.cost : "low",
      reversible: c.reversible !== false,
    }));
    const activeHow = (r.activeScan && r.activeScan.how) || "";
    const scanView = WEEK_INDICATORS.map((w, i) => ({ text: w, done: !!scan[i] }));

    const p = m.probe || {};
    const actions = Array.isArray(p.actions) ? p.actions : [];
    const probeView = actions.map((x, i) => {
      const st = probeState[i] || {};
      const status = PROBE_STATUS_ORDER.indexOf(st.status) >= 0 ? st.status : "todo";
      return {
        idx: i,
        title: x.title || "",
        how: x.how || "",
        success: x.success || "",
        danger: x.danger || "",
        status,
        note: st.note || "",
      };
    });

    const pv = m.pivot || {};
    const pending = Array.isArray(pv.pending) ? pv.pending : [];
    const placed = {};
    for (const src of BUCKET_KEYS) {
      const list = (pv.buckets && pv.buckets[src]) || [];
      list.forEach((it, i) => {
        const itemKey = src + "-" + i;
        const target = pivotMap[itemKey] || src;
        const item = { text: it.text || "", why: it.why || "", src, i, id: itemKey, moved: target !== src };
        (placed[target] = placed[target] || []).push(item);
      });
    }
    const bucketsView = BUCKET_KEYS.map((k) => ({
      key: k,
      label: BUCKET_META[k].label,
      desc: BUCKET_META[k].desc,
      cls: BUCKET_META[k].cls,
      items: placed[k] || [],
    }));

    const cl = m.closure || {};
    const stopSigns = Array.isArray(cl.stopSigns) ? cl.stopSigns : [];
    const review = cl.review || "";
    const fourView = FOUR_QUESTIONS.map((f) => ({ key: f.key, q: f.q, done: !!four[f.key] }));

    // 辩论留痕：按模块归集（backend 使用 legacy step key 记录 debates）
    const d = plan.debates && typeof plan.debates === "object" ? plan.debates : {};
    const debatesByMod = {};
    MODULE_ORDER.forEach((mk) => {
      const legacyKey = MODULE_META[mk].legacyKey;
      debatesByMod[mk] = Array.isArray(d[legacyKey]) ? d[legacyKey] : [];
    });

    return { anchor, cracks, activeHow, scanView, probeView, pending, bucketsView, stopSigns, review, fourView, debates: debatesByMod };
  },

  savePlanState(patch) {
    if (!this.data.id) return;
    local.saveLocalPlanState(this.data.id, patch);
  },

  // M2 主动扫缝
  toggleScanCheck(e) {
    const i = Number(e.currentTarget.dataset.index);
    const state = this.data.plan && this.data.plan.modules ? local.getLocalPlanState(this.data.id) || {} : {};
    const scan = (Array.isArray(state.scan) ? state.scan : []).slice();
    scan[i] = !scan[i];
    local.saveLocalPlanState(this.data.id, { scan });
    this.setData({ modulesView: this.buildModulesView(this.data.plan) });
  },

  // M3 探针状态轮换
  cycleProbeStatus(e) {
    const i = Number(e.currentTarget.dataset.index);
    const state = local.getLocalPlanState(this.data.id) || {};
    const probe = Object.assign({}, (state.probe && typeof state.probe === "object") ? state.probe : {});
    const cur = (probe[i] && probe[i].status) || "todo";
    const next = PROBE_STATUS_ORDER[(PROBE_STATUS_ORDER.indexOf(cur) + 1) % PROBE_STATUS_ORDER.length];
    probe[i] = Object.assign({}, probe[i] || {}, { status: next });
    local.saveLocalPlanState(this.data.id, { probe });
    this.setData({ modulesView: this.buildModulesView(this.data.plan) });
  },
  onProbeNoteBlur(e) {
    const i = Number(e.currentTarget.dataset.index);
    const state = local.getLocalPlanState(this.data.id) || {};
    const probe = Object.assign({}, (state.probe && typeof state.probe === "object") ? state.probe : {});
    probe[i] = Object.assign({}, probe[i] || {}, { note: e.detail.value || "" });
    local.saveLocalPlanState(this.data.id, { probe });
  },

  // M4 局部重判（本地改判记录，不改云端数据）
  moveBucketItem(e) {
    const id = e.currentTarget.dataset.id;
    const target = e.currentTarget.dataset.target;
    if (!id || BUCKET_KEYS.indexOf(target) < 0) return;
    const state = local.getLocalPlanState(this.data.id) || {};
    const pivotMap = Object.assign({}, (state.pivot && typeof state.pivot === "object") ? state.pivot : {});
    pivotMap[id] = target;
    local.saveLocalPlanState(this.data.id, { pivot: pivotMap });
    this.setData({ modulesView: this.buildModulesView(this.data.plan) });
  },

  // M5 四问打卡
  toggleFourCheck(e) {
    const key = e.currentTarget.dataset.key;
    const state = local.getLocalPlanState(this.data.id) || {};
    const four = Object.assign({}, (state.four && typeof state.four === "object") ? state.four : {});
    four[key] = !four[key];
    local.saveLocalPlanState(this.data.id, { four });
    this.setData({ modulesView: this.buildModulesView(this.data.plan) });
  },

  toggleStep(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ ["stepsOpen." + key]: !this.data.stepsOpen[key] });
  },

  // ---- 每节/每模块「我不同意/追问」----
  openModuleDebate(e) {
    if (this.data.debatting) return;
    const modKey = e.currentTarget.dataset.key;
    const legacy = MODULE_META[modKey] ? MODULE_META[modKey].legacyKey : modKey;
    this.setData({ debateKey: legacy, debateText: "", changeNote: "", debateTitle: MODULE_META[modKey] ? MODULE_META[modKey].title : (STEP_LABELS[legacy] || legacy) });
  },
  openStepDebate(e) {
    if (this.data.debatting) return;
    const key = e.currentTarget.dataset.key;
    this.setData({ debateKey: key, debateText: "", changeNote: "", debateTitle: STEP_LABELS[key] || key });
  },
  onCloseDebate() { this.setData({ debateKey: "", debateText: "" }); },
  noop() {},
  onDebateInput(e) { this.setData({ debateText: e.detail.value }); },
  async onSubmitDebate() {
    if (this.data.debatting) return;
    const { debateKey, debateText, plan } = this.data;
    const objection = (debateText || "").trim();
    if (!objection) { wx.showToast({ title: "先写下你的反对或追问", icon: "none" }); return; }
    // 提交即关弹层：页面保持可浏览，右下角浮条显示重算中
    this.setData({ debateKey: "", debateText: "", debatting: true, debateHint: "", debatePending: true });
    try {
      const res = await api.recomputeAction(
        { plan, fromStepKey: debateKey, objection },
        (poll) => this.onDebateProgress2(poll),
      );
      this.applyPlan(res.plan);
      local.saveLocalActionPlan(this.data.id, res.plan);
      this.clearReportDirtyFlag();
      autoSync.sync();
      this.setData({ changeNote: res.changeNote, debateKey: "", debateText: "" });
      wx.showToast({ title: "已更新：" + (res.changeNote || "重算完成"), icon: "none" });
    } catch (e) {
      api.apiErrorToast(e, "重算失败");
    } finally {
      this.setData({ debatting: false, debateHint: "", debatePending: false });
    }
  },

  // v21.7: 行动方案生成遮罩真实阶段
  onActionProgress(poll) {
    if (!poll || poll.done) return;
    const stage = poll.stage || "queued";
    const m = {
      generating: { idx: 1, title: "正在生成方案" },
      parsing: { idx: 2, title: "整理成稿" },
      saving: { idx: 3, title: "收尾" },
    }[stage];
    if (!m) return;
    const progress = Math.max(this.data.progress || 0, Math.min(92, Math.round((poll.progress || 0) * 100)));
    const si = Math.max(this._stageMax || 0, m.idx);
    this._stageMax = si;
    this.setData({
      stageIndex: si,
      progress,
    });
  },

  // v21.7: 行动追问遮罩真实阶段
  onDebateProgress2(poll) {
    if (!poll || poll.done) return;
    const stage = poll.stage || "queued";
    const hint = {
      generating: "正在重演… 约 15~30 秒",
      parsing: "正在整理结果…",
      cascading: "正在联动更新后续章节…",
      saving: "快完成了…",
    }[stage];
    if (hint) this.setData({ debateHint: hint });
  },

  // 生成或重算后，清掉报告页的“已追问”标记，下次再进同一份分析直接看历史行动方案
  clearReportDirtyFlag() {
    try {
      const pages = getCurrentPages();
      const prev = pages && pages[pages.length - 2];
      if (
        prev &&
        prev.route === "pages/report/report" &&
        prev.data &&
        prev.data.id === this.data.id &&
        prev.data.actionDirty
      ) {
        prev.setData({ actionDirty: false });
      }
    } catch (e) { /* ignore */ }
  },

  onGoReport() {
    if (this.data.shared) { wx.switchTab({ url: "/pages/home/home" }); return; }
    wx.navigateBack();
  },

  // ---- 分享 ----
  prepareShare() {
    if (!this.data.plan || this._sharePrepared) return;
    this._sharePrepared = true;
    const p = this.data.plan;
    let first = null;
    let closing = "";
    if (p.modules) {
      const acts = (p.modules.probe && p.modules.probe.actions) || [];
      first = acts[0] || null;
      closing = (p.modules.closure && p.modules.closure.review) || "";
    } else {
      first = (p.steps && p.steps.minimalAction && p.steps.minimalAction.actions && p.steps.minimalAction.actions[0]) || null;
      closing = (p.steps && p.steps.placebo && p.steps.placebo.closingPrinciple) || "";
    }
    const blocks = [
      { k: "今天就能动", v: first ? (first.title + (first.how ? "：" + first.how : "")) : "" },
      { k: "收束", v: closing },
    ].filter((b) => b.v && b.v.trim());
    shareImg.makeShareImage(this, "action-share-canvas", {
      kicker: "解忧果 · 行动方案",
      title: p.headline || "",
      blocks,
      footer: "点开解忧果，把卡住的事理一理",
    }).then((path) => path && this.setData({ shareImage: path })).catch(() => {});
    api.createShare({
      type: "action",
      input: (this.data.analysis && this.data.analysis.input) || "",
      verdict: (this.data.analysis && this.data.analysis.verdict) || p.headline || "",
      skeleton: (this.data.analysis && this.data.analysis.skeleton) || null,
      actionPlan: p,
    }).then((code) => code && this.setData({ shareCode: code })).catch(() => {});
  },

  onShareAppMessage() {
    const plan = this.data.plan;
    const payload = { title: plan && plan.headline ? plan.headline : "解忧果 · 行动" };
    if (this.data.shareCode) {
      payload.path = "/pages/action/action?share=1&code=" + encodeURIComponent(this.data.shareCode);
    } else if (this.data.id) {
      payload.path = "/pages/report/report?id=" + encodeURIComponent(this.data.id);
    } else {
      payload.path = "/pages/home/home";
    }
    if (this.data.shareImage) payload.imageUrl = this.data.shareImage;
    return payload;
  },

  onShareTimeline() {
    const plan = this.data.plan;
    return {
      title: plan && plan.headline ? plan.headline : "解忧果 · 清醒行动",
      query: this.data.id ? "id=" + encodeURIComponent(this.data.id) + "&source=share_timeline_action" : "source=share_timeline_action",
    };
  },
});
