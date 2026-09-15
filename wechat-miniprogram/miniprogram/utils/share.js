// 分享小卡生成：离屏 canvas 2d 画一张 750x600 的深色金边卡片，输出 jpg 临时路径。
// 用法：utils/share.js -> makeShareImage(页面实例, canvasId, opts)，返回 Promise<string>（失败返回空串）
// opts: { kicker, title, blocks: [{k, v}], footer }

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const ch of String(text || "")) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCard(canvas, opts) {
  return new Promise((resolve, reject) => {
    try {
      const W = 750;
      const H = 600;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // 背景
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#1b2130");
      grad.addColorStop(0.6, "#141926");
      grad.addColorStop(1, "#10141d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 顶部金线
      ctx.fillStyle = "#e4c66f";
      ctx.fillRect(0, 0, W, 6);

      // 品牌行
      ctx.fillStyle = "#e4c66f";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(opts.kicker || "解忧果 · STRUCTURE LENS", 44, 58);

      // 标题（最多 4 行）
      ctx.fillStyle = "#f2efe4";
      ctx.font = "bold 44px sans-serif";
      const titleLines = wrapText(ctx, opts.title || "", W - 88);
      let y = 130;
      ctx.save();
      ctx.beginPath();
      ctx.rect(44, 96, W - 88, 200);
      ctx.clip();
      for (const ln of titleLines.slice(0, 4)) {
        ctx.fillText(ln, 44, y);
        y += 52;
      }
      ctx.restore();
      y = Math.min(y, 300) + 18;

      // 分隔线
      ctx.strokeStyle = "rgba(226,196,111,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(44, y);
      ctx.lineTo(W - 44, y);
      ctx.stroke();
      y += 26;

      // 内容块
      const blocks = opts.blocks || [];
      let bodyTop = y;
      // 底部留出 footer 区域，避免内容块压住最下面一行字
      const bodyMax = H - 140;
      for (const b of blocks) {
        if (y > bodyMax) break;
        const kText = String(b.k || "");
        const vText = String(b.v || "");
        ctx.font = "bold 26px sans-serif";
        const kLines = kText ? wrapText(ctx, kText, W - 150) : [];
        ctx.font = "26px sans-serif";
        const vLines = wrapText(ctx, vText, W - 150);
        const totalLines = kLines.length + vLines.length;
        let cardH = Math.min(120, Math.max(64, totalLines * 34 + 28));
        if (y + cardH > bodyMax) cardH = bodyMax - y;
        if (cardH <= 0) break;
        // 块底色
        const wave = (b.k || "") + (b.v || "");
        const rh = (wave.split("").reduce(function (a, c) { return (a * 31 + c.charCodeAt(0)) % 997; }, 0) % 100) / 100;
        const cardFill = "rgba(226,196,111," + (0.10 + rh * 0.10).toFixed(2) + ")";
        ctx.fillStyle = cardFill;
        drawRoundedRect(ctx, 44, y, W - 88, cardH, 18);
        ctx.fill();
        ctx.strokeStyle = "rgba(226,196,111,0.35)";
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, 44, y, W - 88, cardH, 18);
        ctx.stroke();
        // 文本
        let ty = y + 36;
        ctx.fillStyle = "#e4c66f";
        ctx.font = "bold 24px sans-serif";
        for (const ln of kLines) { ctx.fillText(ln, 68, ty); ty += 30; }
        ctx.fillStyle = "#e6e8ee";
        ctx.font = "25px sans-serif";
        for (const ln of vLines) {
          if (ty > y + cardH - 12) break;
          ctx.fillText(ln, 68, ty);
          ty += 32;
        }
        y += cardH + 18;
      }

      // 底部
      ctx.fillStyle = "#878fa1";
      ctx.font = "23px sans-serif";
      ctx.fillStyle = "rgba(14,17,25,0.96)";
      ctx.fillRect(0, H - 62, W, 62);
      ctx.fillStyle = "#878fa1";
      ctx.font = "23px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(opts.footer || "解忧果 · 看穿结构，顺便找到行动", W / 2, H - 34);
      ctx.textAlign = "left";

      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: W,
        height: H,
        destWidth: W,
        destHeight: H,
        fileType: "jpg",
        quality: 0.9,
        success: (res) => resolve(res.tempFilePath || ""),
        fail: () => resolve(""),
      });
    } catch (e) {
      resolve("");
    }
  });
}

/** 页面里调用：拿到 #canvasId 的 canvas 2d 节点再画，画失败返回空串（分享时兜底默认截图）。 */
function makeShareImage(page, canvasId, opts) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .select("#" + canvasId)
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) {
          resolve("");
          return;
        }
        drawCard(item.node, opts).then(resolve).catch(() => resolve(""));
      });
  });
}

module.exports = { makeShareImage, wrapText };
