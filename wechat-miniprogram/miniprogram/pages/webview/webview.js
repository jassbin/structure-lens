// 原文链接落地页：直接用 web-view 打开（需业务域名白名单，未配置的域名会出现微信提示）
Page({
  data: { url: "" },
  onLoad(options) {
    const url = decodeURIComponent(options.url || "");
    this.setData({ url });
    if (!url) {
      wx.showToast({ title: "链接不存在", icon: "none" });
    }
  },
});
