// 首页：输入 → 分诊 → （对齐卡确认）→ 分析遮罩 → 跳报告页
const api = require("../../utils/api");
const local = require("../../utils/local");
const autoSync = require("../../utils/auto-sync");

const DEEP_TOPICS = [
  { id: "t1", icon: "💼", title: "公司加班文化", prompt: "为什么很多公司明明人不够，却要求所有人加班而不是多招人？" },
  { id: "t2", icon: "🛵", title: "外卖平台抽成", prompt: "为什么外卖平台一边给商家高抽成，一边又不断给用户发优惠券补贴？" },
  { id: "t3", icon: "👨‍👩‍👧", title: "催婚现象", prompt: "为什么明明婚育成本这么高，长辈还是年年催婚催生？" },
];

// 分析遮罩：时间驱动乐观进度（参考原作 AnalyzingOverlay），后端实际 30-60s
const ANALYZE_STAGES = ["联网核对事实依据", "筛选底层结构骨架", "逐层跑 8 步深度穿透", "整理反转与行动线索"];
const ANALYZE_STAGE_STARTS = [0, 8, 16, 28];
const ANALYZE_EXPECTED_SECONDS = 45;

Page({
  data: {
    input: "",
    submitting: false,
    analyzing: false,
    warmStage: "", // 冷启动预热时的过渡页提示文案
    stages: ANALYZE_STAGES,
    stageIndex: 0,
    progress: 0,
    elapsed: 0,
    etaSec: ANALYZE_EXPECTED_SECONDS,
    triage: null, // {verdict, probes|suggestion}
    align: null, // {summary, sources}
    showTriage: false,
    showAlign: false,
    inputFocus: false,
    precheckRound: 0, // question rounds, backend force-passes at >=3
    topics: DEEP_TOPICS,
  },

  onLoad() {
    // 首页自 1.0.45 起不再展示「今日推荐拆解」
  },


  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // 回到首页时恢复 tabbar（分析中隐藏过）
    if (!this.data.analyzing) {
      try { wx.showTabBar({ animation: false }); } catch (e) { /* ignore */ }
    }
  },

  // 输入过程中绝不重置 focus（否则打一个字键盘就会收起）；只在真实失焦时清掉聚焦标记
  onInput(e) {
    this.setData({ input: e.detail.value });
  },
  onInputBlur() {
    if (this.data.inputFocus) this.setData({ inputFocus: false });
  },

  // 清空回到初始
  onReset() {
    this.setData({
      triage: null,
      align: null,
      showTriage: false,
      showAlign: false,
      input: "",
      precheckRound: 0,
    });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const input = (this.data.input || "").trim();
    if (!input) {
      wx.showToast({ title: "先写下那件让你觉得不对劲的事", icon: "none" });
      return;
    }
    this.setData({ submitting: true, triage: null, align: null, showTriage: false, showAlign: false });
    try {
      // 预检 v21.16（含冷启动恢复）
      const res = await this.precheckRecovered(input, {
        round: this.data.precheckRound, // v21.17: 每次点击都重新搜索，round 只作防死循环安全阀
      });
      if (res.status === "diggable") {
        // 公开清晰：带来源直接分析；个人私事/已搜过一次：不再联网直接分析
        const opts = res.sources && res.sources.length
            ? { alignedSources: res.sources, aligned: true }
            : { aligned: true, skipSearch: true }; // 搜不到+说清楚：直接分析，不再联网
        this.resetSessionMarkers();
        await this.doAnalyze(input, opts, true);
        return;
      }
      this.markRoundUsed(); // 没直接通过 -> 轮数+1；补充后再点照一会重新搜索索
      this.tearDownAnalyzing();
      if (res.status === "align") {
        // 弹事实对齐卡确认
        this.setData({
          align: { input: res.input, summary: res.summary, sources: res.sources || [], candidates: res.candidates || [] },
          showAlign: true,
        });
      } else {
        // need_detail / not_applicable -> 反问题引导
        const triage = res.triage || { verdict: res.status, probes: [] };
        this.setData({ triage, showTriage: true });
      }
    } catch (e) {
      this.tearDownAnalyzing();
      api.reportError("precheck", e && e.message);
      api.apiErrorToast(e, "分析失败，请稍后再试");
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 会话流程标记（v21.16）
  markRoundUsed() {
    // 没走到分析 -> 轮数+1（后端安全阀用）；补充后再点照一照会重新搜索
    this.setData({ precheckRound: (this.data.precheckRound || 0) + 1 });
  },
  resetSessionMarkers() {
    this.setData({ precheckRound: 0 });
  },

  // 对齐卡：确认（带来源分析）
  onAlignConfirm() {
    const a = this.data.align;
    this.setData({ showAlign: false });
    // 传入 alignedSources + aligned 标记，跳过分诊与重复搜索
    this.doAnalyze(this.data.input, {
      alignedSources: a.sources,
      aligned: true,
    });
  },

  // 对齐卡：都不是 → 回输入框补充细节，再照一次
  onAlignSkip() {
    this.markRoundUsed(); // 候选都不是 -> 不再搜
    this.setData({ showAlign: false, inputFocus: true });
    wx.showToast({ title: "在输入框补充细节后，再点照一照", icon: "none" });
  },

  // ============ 冷启动恢复：第一次点“照一照”若遇 503/超时，先进过渡页，后台续醒服务 ============
  isTransientError(e) {
    const status = e && e.status;
    const msg = String((e && (e.message || e.errMsg)) || "");
    return (
      !status ||
      status >= 500 ||
      status === 408 ||
      status === 429 ||
      /timeout|timed-?out|超时/iu.test(msg)
    );
  },

  // 预检走冷启动恢复：一次正常预检失败且属瞬时错 → 立刻进过渡页（给用户“有反应”），后台递增重试唤醒
  async precheckRecovered(input, opts) {
    let lastErr = null;
    try {
      return await api.precheck(input, opts);
    } catch (e) {
      lastErr = e;
      if (!this.isTransientError(e)) throw e;
    }
    this.startWarmUp();
    // 睡眠合计 96s + 请求开销 => 覆盖约 110s 冷启动窗口（实例 + MySQL 同时唤醒够用）
    const delays = [2000, 3000, 5000, 8000, 12000, 16000, 20000, 30000];
    for (const d of delays) {
      await new Promise((r) => setTimeout(r, d));
      try {
        const res = await api.precheck(input, opts);
        return res; // 成功：过渡页保持，随后 onSubmit 直接进入 doAnalyze
      } catch (e) {
        if (!this.isTransientError(e)) { this.tearDownAnalyzing(); throw e; }
        lastErr = e;
      }
    }
    this.tearDownAnalyzing();
    api.reportError("wakeup-timeout", lastErr && lastErr.message);
    throw lastErr || new Error("服务唤醒超时，请稍后再试");
  },

  // 冷启动等待时先起过渡遮罩（柔和进度），让用户第一时间感受到“有反应”
  startWarmUp() {
    try { wx.hideTabBar({ animation: false }); } catch (e) { /* ignore */ }
    this._warmT0 = Date.now();
    this.setData({ analyzing: true, warmStage: "正在唤醒云端服务…", stageIndex: 0, progress: 2, elapsed: 0, etaSec: ANALYZE_EXPECTED_SECONDS });
    if (this._analyzeTimer) clearInterval(this._analyzeTimer);
    this._analyzeTimer = setInterval(() => {
      const elapsed = (Date.now() - (this._warmT0 || Date.now())) / 1000;
      const progress = Math.min(80, Math.round((1 - Math.exp(-elapsed / (ANALYZE_EXPECTED_SECONDS / 2.5))) * 100));
      const etaSec = Math.max(5, Math.ceil(ANALYZE_EXPECTED_SECONDS * (1 - progress / 100)));
      this.setData({ progress, elapsed: Math.floor(elapsed), etaSec });
    }, 500);
  },

  // 收尾：停掉进度计时器、撤掉遮罩、恢复 tabbar
  tearDownAnalyzing() {
    if (this._analyzeTimer) { clearInterval(this._analyzeTimer); this._analyzeTimer = null; }
    this.setData({ analyzing: false, warmStage: "" });
    try { wx.showTabBar({ animation: false }); } catch (e) { /* ignore */ }
  },

  async doAnalyze(input, opts, alreadyOverlay) {
    // alreadyOverlay=true：预检冷启动恢复时已进了过渡页，本次复用同一遮罩，避免闪屏
    if (this.data.analyzing && !alreadyOverlay) return;
    if (!this.data.analyzing) {
      try { wx.hideTabBar({ animation: false }); } catch (e) { /* ignore */ }
    }
    // 每次都重建“正式分析”进度（alreadyOverlay 时旧的只是预热进度）
    const startedAt = Date.now();
    this._stageMax = 0; // 阶段只前进（防真机 setData 时序导致回跳）
    this.setData({
      analyzing: true,
      warmStage: "",
      stageIndex: 0,
      progress: 0,
      elapsed: 0,
      etaSec: ANALYZE_EXPECTED_SECONDS,
    });
    if (this._analyzeTimer) clearInterval(this._analyzeTimer);
    this._analyzeTimer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const progress = Math.min(
        92,
        Math.round((1 - Math.exp(-elapsed / (ANALYZE_EXPECTED_SECONDS / 2.5))) * 100),
      );
      let stageIndex = 0;
      for (let i = 0; i < ANALYZE_STAGE_STARTS.length; i++) {
        if (elapsed >= ANALYZE_STAGE_STARTS[i]) stageIndex = i;
      }
      stageIndex = Math.max(this._stageMax || 0, stageIndex);
      this._stageMax = stageIndex;
      const etaSec = Math.max(5, Math.ceil(ANALYZE_EXPECTED_SECONDS * (1 - progress / 100)));
      this.setData({ stageIndex, progress, elapsed: Math.floor(elapsed), etaSec });
    }, 200);

    try {
      const res = await this.analyzeWithRetry(input, {
        ...(opts || {}),
        onProgress: (poll) => this.onAnalyzeProgress(poll),
      });
      if (this._analyzeTimer) { clearInterval(this._analyzeTimer); this._analyzeTimer = null; }
      if (res.status === "diggable") {
        const result = res.result;
        // 免登录本地持久化 + 并入本地结构地图
        local.saveLocalAnalysis(result);
        if (result.skeleton) {
          local.mergeLocalStructure(result.skeleton, result.verdict || result.input);
        }
        autoSync.sync(); // 生成分析后自动同步
        // 关键：保留 analyzing=true（遮罩不撤），页面切换期由报告页自身的整屏 loading 承接，
        // 全程深色，不会闪回首页。
        wx.navigateTo({
          url: `/pages/report/report?id=${encodeURIComponent(result.id)}`,
          complete: () => {
            // 等页面切换动画结束再撤遮罩，避免切页瞬间闪回首页
            setTimeout(() => {
              this.setData({ analyzing: false, warmStage: "" });
              try { wx.showTabBar({ animation: false }); } catch (e) { /* ignore */ }
            }, 360);
          },
        });
      } else {
        // 仍被分诊拦截
        this.tearDownAnalyzing();
        this.setData({ triage: res.triage || { verdict: res.status }, showTriage: true });
      }
    } catch (e) {
      this.tearDownAnalyzing();
      api.reportError("analyze", e && e.message);
      api.apiErrorToast(e, "分析失败，请重试");
    }
  },

  // 分析自动重试（治标）：AI 冷启动/瞬时抖动不把遮罩扯掉，后台最多再试 2 次
  async analyzeWithRetry(input, opts) {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        return await api.analyze(input, opts);
      } catch (e) {
        lastErr = e;
        if (!this.isTransientError(e) || i === 2) throw e;
        this.setData({ warmStage: "分析途中有点忙，正在自动重试…" });
        await new Promise((r) => setTimeout(r, 4000 + i * 4000));
      }
    }
    throw lastErr || new Error("分析失败");
  },

  // v21.7: 用后端真实阶段推动遮罩进度（不改分析逻辑）
  onAnalyzeProgress(poll) {
    if (!poll || poll.done) return;
    const stage = poll.stage || "queued";
    const map = {
      searching: { idx: 0, title: "联网核对事实依据" },
      generating: { idx: 1, title: "筛选底层结构骨架" },
      parsing: { idx: 2, title: "逐层跑 8 步深度穿透" },
      saving: { idx: 3, title: "整理反转与行动线索" },
    };
    const m = map[stage];
    if (!m) return;
    const progress = Math.max(this.data.progress, Math.min(95, Math.round((poll.progress || 0) * 100)));
    const etaSec = Math.max(3, Math.ceil(ANALYZE_EXPECTED_SECONDS * (1 - progress / 100)));
    const si = Math.max(this._stageMax || 0, m.idx);
    this._stageMax = si;
    this.setData({
      stageIndex: si,
      progress,
      warmStage: m.title,
      etaSec,
    });
  },

  onTapTopic(e) {
    const { prompt } = e.currentTarget.dataset;
    this.setData({ input: prompt });
  },

  onShareAppMessage() {
    return {
      title: "解忧果 · 把让你「不对劲」的事照一照",
      path: "/pages/home/home?source=share_home",
    };
  },

  onShareTimeline() {
    return {
      title: "解忧果 · 结构拆解，看穿一件让你不对劲的事",
      query: "source=share_timeline_home",
    };
  },

  // 长按页脚版本查看诊断弹窗：环境状态 + 最近请求流水（每行 phase 表示走到哪一步）
  onShowDiag() {
    const g = (getApp() && getApp().globalData) || {};
    const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
    const head = [
      "------ 环境状态 ------",
      "基础库 SDK: " + (g.sdkVersion || "?"),
      "wx.cloud: " + (g.cloudAvailable ? "有" : "无"),
      "callContainer: " + (g.cloudCallAvailable ? "有" : "无"),
      "init 错误: " + (g.cloudInitError || "无"),
      "容器 env: " + (g.containerEnvId || "?"),
      "------ 请求记录 ------",
    ];
    const lines = (api.getDiag() || []).map((d) => {
      const t = new Date(d.t || 0);
      const hh = pad2(t.getHours()) + ":" + pad2(t.getMinutes()) + ":" + pad2(t.getSeconds());
      const p = d.phase || "?";
      const base = hh + " [" + p + "] " + (d.path || "") + (p === "begin" ? " cloud=" + (d.cloud ? "1" : "0") : " " + (d.status || 0) + " " + (d.ms || 0) + "ms");
      return base + (d.err ? " " + d.err : "");
    });
    const content = head.concat(lines.length ? lines : ["（暂无请求记录）"]).join("\n");
    wx.showModal({ title: "诊断日志", content, showCancel: false, confirmText: "知道了" });
  },
});
