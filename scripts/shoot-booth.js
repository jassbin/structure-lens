const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000/deck/booth.html", {
    waitUntil: "networkidle0",
  });
  // 隐藏工具按钮再截
  await page.addStyleTag({ content: ".tools{display:none!important}" });
  await new Promise((r) => setTimeout(r, 400));

  // PNG（整页）
  await page.screenshot({
    path: "public/deck/booth.png",
    fullPage: true,
  });

  // PDF（横向，适合当一页 PPT）
  await page.pdf({
    path: "public/deck/booth.pdf",
    landscape: true,
    printBackground: true,
    width: "1280px",
    height: "720px",
  });

  await browser.close();
  console.log("done");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
