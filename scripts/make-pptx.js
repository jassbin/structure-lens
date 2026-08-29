const pptxgen = require("pptxgenjs");
const fs = require("fs");

const p = new pptxgen();
p.defineLayoutName ? null : null;
p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

const TEAL = "0F766E";
const TEALSOFT = "0D9488";
const INK = "0F172A";
const SUB = "475569";

const s = p.addSlide();

// 清新渐变背景
s.background = { color: "F0FDFA" };
// 右上/左下柔和色块
s.addShape(p.ShapeType.rect, { x: 8.2, y: -1.2, w: 6.5, h: 5, fill: { color: "99F6E4", transparency: 55 }, line: { type: "none" }, rotate: 15 });
s.addShape(p.ShapeType.rect, { x: -1.5, y: 4.8, w: 6.5, h: 4, fill: { color: "BAE6FD", transparency: 55 }, line: { type: "none" }, rotate: -12 });

// 内容卡
s.addShape(p.ShapeType.roundRect, { x: 0.5, y: 0.5, w: 12.33, h: 6.5, rectRadius: 0.25, fill: { color: "FFFFFF", transparency: 20 }, line: { color: "0D9488", width: 1, transparency: 70 } });

// 品牌名
s.addText(
  [
    { text: "照妖镜", options: { fontSize: 60, bold: true, color: INK } },
    { text: "  Structure Lens", options: { fontSize: 20, bold: true, color: "94A3B8" } },
  ],
  { x: 0.9, y: 0.7, w: 11.5, h: 1.2, align: "left" }
);

// Slogan
s.addText('专治"表面一套、底下一套"', {
  x: 0.9, y: 1.95, w: 11, h: 0.8, fontSize: 30, bold: true, color: TEAL, align: "left",
});

// 描述
s.addText(
  [
    { text: "把任意热点事件、政策或决策丢进来，AI 联网锁定真相，用一套固定的 ", options: { color: SUB } },
    { text: "8 步深度穿透", options: { color: TEAL, bold: true } },
    { text: " 层层剥开表面叙事，还原背后的 ", options: { color: SUB } },
    { text: "底层结构骨架", options: { color: TEAL, bold: true } },
    { text: " —— 谁在提取价值、谁被委托背锅、权力如何运作。", options: { color: SUB } },
  ],
  { x: 0.9, y: 2.85, w: 7.3, h: 1.6, fontSize: 17, align: "left", lineSpacingMultiple: 1.3 }
);

// 能力标签
const pills = ["AI 原生", "8 步穿透管线", "结构骨架还原", "套路聚类", "可辩论的 AI", "只读分享卡"];
let px = 0.9, py = 4.7;
pills.forEach((t) => {
  const w = 0.55 + t.length * 0.22;
  if (px + w > 8.2) { px = 0.9; py += 0.7; }
  s.addText(t, { x: px, y: py, w, h: 0.5, fontSize: 14, bold: true, color: TEAL, align: "center",
    fill: { color: "CCFBF1" }, line: { color: TEALSOFT, width: 1, transparency: 55 }, rectRadius: 0.25, shape: p.ShapeType.roundRect });
  px += w + 0.2;
});

// 二维码
if (fs.existsSync("public/qr-booth.png")) {
  s.addImage({ path: "public/qr-booth.png", x: 9.35, y: 2.9, w: 2.6, h: 2.6, rounding: true });
}
s.addText("📱 扫码，立即照一照", { x: 8.9, y: 5.55, w: 3.5, h: 0.5, fontSize: 18, bold: true, color: INK, align: "center" });
s.addText("structure-lens-8c3bf836.eazo.dev", { x: 8.9, y: 6.0, w: 3.5, h: 0.4, fontSize: 12, color: "64748B", align: "center" });

p.writeFile({ fileName: "public/deck/照妖镜-摆摊速览.pptx" }).then((f) => {
  console.log("saved", f);
});
