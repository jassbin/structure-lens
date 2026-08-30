const pptxgen = require("pptxgenjs");
const fs = require("fs");

const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in

const TEAL = "0F766E", TEALSOFT = "0D9488", INK = "0F172A", SUB = "475569", BG = "F0FDFA";

function base(s) {
  s.background = { color: BG };
  s.addShape(p.ShapeType.rect, { x: 8.2, y: -1.2, w: 6.5, h: 5, fill: { color: "99F6E4", transparency: 60 }, line: { type: "none" }, rotate: 15 });
  s.addShape(p.ShapeType.rect, { x: -1.5, y: 4.8, w: 6.5, h: 4, fill: { color: "BAE6FD", transparency: 60 }, line: { type: "none" }, rotate: -12 });
}
function title(s, t) {
  s.addText(t, { x: 0.7, y: 0.45, w: 12, h: 0.9, fontSize: 30, bold: true, color: INK, align: "left" });
  s.addShape(p.ShapeType.rect, { x: 0.75, y: 1.35, w: 1.6, h: 0.06, fill: { color: TEALSOFT }, line: { type: "none" } });
}
function card(s, x, y, w, h, head, body) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: "FFFFFF", transparency: 15 }, line: { color: TEALSOFT, width: 1, transparency: 65 } });
  s.addText(head, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.5, fontSize: 16, bold: true, color: TEALSOFT });
  s.addText(body, { x: x + 0.25, y: y + 0.75, w: w - 0.5, h: h - 0.9, fontSize: 14, color: SUB, valign: "top", lineSpacingMultiple: 1.25 });
}

// ---- 1 封面 ----
let s = p.addSlide(); base(s);
s.addText([{ text: "照妖镜", options: { fontSize: 66, bold: true, color: INK } }, { text: "  Structure Lens", options: { fontSize: 22, bold: true, color: "94A3B8" } }], { x: 0.9, y: 2.1, w: 11.5, h: 1.3, align: "left" });
s.addText('专治"表面一套、底下一套"——放进来，照给你看', { x: 0.9, y: 3.5, w: 11, h: 0.8, fontSize: 26, bold: true, color: TEAL });
s.addText("AI 原生的「事件结构透视」工具　·　#shenicest-fission", { x: 0.9, y: 4.5, w: 11, h: 0.6, fontSize: 15, color: SUB });

// ---- 2 问题 ----
s = p.addSlide(); base(s); title(s, "① 问题");
s.addText([
  { text: "每天的热点、政策、"反转"新闻扑面而来。\n\n", options: { fontSize: 20, color: INK, bold: true } },
  { text: "• 多数人被表面叙事牵着走：愤怒、站队、遗忘\n", options: { fontSize: 18, color: SUB } },
  { text: "• 没有工具帮普通人冷静拆开事件、看清底层结构\n", options: { fontSize: 18, color: SUB } },
  { text: "• 谁在提取价值？谁被委托背锅？权力如何运作？\n\n", options: { fontSize: 18, color: SUB } },
  { text: "→ 缺一把"认知手术刀"，把看热闹变成看门道。", options: { fontSize: 18, color: TEALSOFT, bold: true } },
], { x: 0.9, y: 1.8, w: 11, h: 5, valign: "top", lineSpacingMultiple: 1.3 });

// ---- 3 方案 ----
s = p.addSlide(); base(s); title(s, "② 方案");
s.addText([
  { text: "照妖镜 = ", options: { color: INK, bold: true } },
  { text: "联网锁定真相", options: { color: TEALSOFT, bold: true } },
  { text: " + ", options: { color: INK } },
  { text: "固定 8 步深度穿透", options: { color: TEALSOFT, bold: true } },
  { text: " + ", options: { color: INK } },
  { text: "还原结构骨架", options: { color: TEALSOFT, bold: true } },
], { x: 0.9, y: 1.7, w: 11.5, h: 0.7, fontSize: 20 });
card(s, 0.9, 2.7, 3.7, 3.4, "输入即拆", "丢入任意事件 / 政策 / 决策，AI 先联网锁定真实信息。");
card(s, 4.85, 2.7, 3.7, 3.4, "逐层穿透", "沿固定 8 步剥离情绪与话术，一步步直达底层逻辑。");
card(s, 8.8, 2.7, 3.6, 3.4, "结构还原", "输出可视化结构骨架，并凝练一句直击本质的金句。");

// ---- 4 核心① 8 步 ----
s = p.addSlide(); base(s); title(s, "③ 核心之一 · 8 步分析管线");
const steps = ["陈述表面叙事：事件被如何讲述", "剥离情绪与话术：去掉带节奏部分", "识别关键角色：谁在场、谁发声", "追踪利益流动：钱/资源/风险往哪走", "定位价值提取方：谁真正获益", "找出委托背锅方：谁承担代价", "还原权力运作：话语与规则如何被定义", "凝练金句：一句话说穿底层逻辑"];
steps.forEach((t, i) => {
  const col = i < 4 ? 0 : 1, row = i % 4;
  const x = 0.9 + col * 6.1, y = 1.85 + row * 1.15;
  s.addText(String(i + 1).padStart(2, "0"), { x, y, w: 0.7, h: 0.9, fontSize: 24, bold: true, color: TEALSOFT, align: "center", valign: "middle" });
  s.addText(t, { x: x + 0.75, y, w: 5.1, h: 0.9, fontSize: 15, color: INK, valign: "middle" });
});

// ---- 5 核心② 结构骨架 ----
s = p.addSlide(); base(s); title(s, "③ 核心之二 · 结构骨架");
s.addText("8 步的终点，是把事件还原成一副可复用的"骨架"：", { x: 0.9, y: 1.7, w: 11, h: 0.6, fontSize: 18, color: SUB });
card(s, 0.9, 2.5, 3.7, 2.3, "价值提取", "谁在效率红利里套现、获益。");
card(s, 4.85, 2.5, 3.7, 2.3, "委托背锅", "谁被推去承担代价、成为叙事替罪。");
card(s, 8.8, 2.5, 3.6, 2.3, "权力运作", "话语与规则如何被定义、被谁掌握。");
s.addText("表面千差万别，底层其实是同一套结构。", { x: 0.9, y: 5.3, w: 11.5, h: 0.9, fontSize: 26, bold: true, color: INK });
s.addShape(p.ShapeType.rect, { x: 0.9, y: 5.35, w: 0.08, h: 0.8, fill: { color: TEAL }, line: { type: "none" } });

// ---- 6 技术栈 ----
s = p.addSlide(); base(s); title(s, "④ 技术栈");
card(s, 0.9, 1.8, 5.75, 2.0, "前端 / 交互", "Next.js App Router · TypeScript · Tailwind CSS · framer-motion · react-i18next 双语");
card(s, 6.85, 1.8, 5.55, 2.0, "数据 / AI", "PostgreSQL · Drizzle ORM · Eazo 内置 AI · 联网检索");
card(s, 0.9, 4.0, 5.75, 2.0, "平台 / 部署", "@eazo/sdk · MCP Server · Vercel 部署");
card(s, 6.85, 4.0, 5.55, 2.0, "后端接口", "analyze · drill · recompute · walk-focus · share；DATABASE_URL 仅服务端可见，MCP 可被外部 Agent 调用。");

// ---- 7 创新点 ----
s = p.addSlide(); base(s); title(s, "⑤ 创新点");
s.addText([
  { text: "结构化而非情绪化", options: { color: TEALSOFT, bold: true } }, { text: "：可复用方法论，产出可验证的结构\n", options: { color: SUB } },
  { text: "AI 原生自动锁定", options: { color: TEALSOFT, bold: true } }, { text: "：宽泛方向 → 锁定真实最火事件 → 自动分析\n", options: { color: SUB } },
  { text: "可辩论的 AI", options: { color: TEALSOFT, bold: true } }, { text: "："我不同意"追问，AI 正面直答"为什么"\n", options: { color: SUB } },
  { text: "同构套路库", options: { color: TEALSOFT, bold: true } }, { text: "：跨事件识别同一副骨架，沉淀套路\n", options: { color: SUB } },
  { text: "隐私优先传播", options: { color: TEALSOFT, bold: true } }, { text: "：只读快照短链，不泄露身份与地图", options: { color: SUB } },
], { x: 0.9, y: 1.9, w: 11.5, h: 5, fontSize: 19, valign: "top", lineSpacingMultiple: 1.55, bullet: { characterCode: "2022", indent: 20 } });

// ---- 8 后续 + 二维码 ----
s = p.addSlide(); base(s); title(s, "⑥ 后续计划 · 立即体验");
s.addText([
  { text: "• 结构方法论沉淀为公开"套路百科"，社区共建投票\n", options: {} },
  { text: "• 多信源交叉核验 + 可信度标注\n", options: {} },
  { text: "• 长文 / 多事件时间线的结构演化追踪\n", options: {} },
  { text: "• 开放 MCP / API，成为其他 AI 应用的"结构分析"底座", options: {} },
], { x: 0.9, y: 1.9, w: 7.6, h: 3.5, fontSize: 17, color: SUB, valign: "top", lineSpacingMultiple: 1.4 });
if (fs.existsSync("public/qr-booth.png")) s.addImage({ path: "public/qr-booth.png", x: 9.6, y: 2.3, w: 2.5, h: 2.5, rounding: true });
s.addText("📱 扫码，立即照一照", { x: 9.1, y: 4.95, w: 3.5, h: 0.5, fontSize: 17, bold: true, color: INK, align: "center" });
s.addText("structure-lens-8c3bf836.eazo.dev", { x: 9.1, y: 5.4, w: 3.5, h: 0.4, fontSize: 12, color: SUB, align: "center" });

p.writeFile({ fileName: "public/deck/照妖镜-摆摊演示.pptx" }).then((f) => console.log("saved", f));
