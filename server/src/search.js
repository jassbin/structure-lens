// 联网检索 —— 国内可直连的多源搜索引擎（替代 DuckDuckGo；服务器为腾讯云国内，DDG 不可达）
// 主源：360 搜索（https://www.so.com/s）  回退：搜狗搜索（https://www.sogou.com/web）
// 两者均无需 Key/注册，返回真实网页链接；360 无结果或异常时自动回退搜狗；全失败返回空数组（调用方有兜底）。

const { execFile } = require("node:child_process");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** 解码常见 HTML 实体 */
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

/** curl 优先（容器已装 curl，--compressed 拿 gzip），失败回退 fetch */
function curlGet(url, maxTime = 9) {
  return new Promise((resolve) => {
    execFile(
      "curl",
      ["-s", "--max-time", String(maxTime), "-L", "-A", UA, "--compressed", url],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => resolve(err ? "" : stdout),
    );
  });
}

async function fetchGet(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(9000),
  });
  return res.ok ? await res.text() : "";
}

async function fetchHtml(url) {
  const viaCurl = await curlGet(url);
  if (viaCurl) return viaCurl;
  return fetchGet(url).catch(() => "");
}

/** 360 搜索：解析 <li class="res-list"> 结果块；只保留带 data-mdurl 的真实外链 */
function parse360(html) {
  const results = [];
  const parts = html.split(/<li class="res-list"[^>]*>/).slice(1);
  for (const part of parts) {
    const end = part.indexOf("</li>");
    const seg = end >= 0 ? part.slice(0, end) : part;
    if (!/class="res-title"/.test(seg)) continue;
    const titleM = seg.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    if (!titleM) continue;
    const title = stripTags(titleM[1]).replace(/\s+/g, " ").trim();
    if (!title) continue;
    // 只接受 data-mdurl（真实落地页），跳过 /link? 跳转与站内聚合板块
    const md = seg.match(/data-mdurl="([^"]+)"/);
    if (!md) continue;
    let url = md[1];
    if (!/^https?:/.test(url)) continue;
    // 排除 360 站内聚合：ai.so.com / image.so.com / pic.so.com 等
    if (/^https?:\/\/[a-z0-9-]*\.?so\.com\//.test(url)) continue;
    const descM =
      seg.match(/class="res-desc"[^>]*>([\s\S]*?)<\/p>/) ||
      seg.match(/res-list-summary">([\s\S]*?)<\/span>/);
    const snippet = descM ? stripTags(descM[1]).replace(/\s+/g, " ").trim().slice(0, 160) : "";
    results.push({ title, url, snippet });
    if (results.length >= 8) break;
  }
  return results;
}

/** 搜狗搜索：解析 <h3 class="vr-title"> 结果块；相对链接补全为跳转地址 */
function parseSogou(html) {
  const results = [];
  const re = /<h3[^>]*class="[^"]*(?:vr-title|vrTitle)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && results.length < 8) {
    const title = stripTags(m[2]).replace(/\s+/g, " ").trim();
    if (!title) continue;
    let url = m[1].replace(/&amp;/g, "&");
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = "https://www.sogou.com" + url;
    if (!/^https?:/.test(url)) continue;
    const tail = html.slice(m.index, m.index + 1200);
    const snippetM = tail.match(/class="str_info"[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snippetM
      ? stripTags(snippetM[1]).replace(/\s+/g, " ").trim().slice(0, 160)
      : "";
    results.push({ title, url, snippet });
  }
  return results;
}

/** 联网搜索入口（兼容旧 ddgSearch 签名）。360 → 搜狗 → 空数组 */
async function search(query, count = 6) {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const html = await fetchHtml(`https://www.so.com/s?q=${encodeURIComponent(q)}`);
    if (html) {
      const res = parse360(html);
      if (res.length > 0) return res.slice(0, count);
    }
  } catch {
    // 回退
  }
  try {
    const html = await fetchHtml(`https://www.sogou.com/web?query=${encodeURIComponent(q)}`);
    if (html) {
      const res = parseSogou(html);
      if (res.length > 0) return res.slice(0, count);
    }
  } catch {
    // 空结果
  }
  return [];
}

/** 旧名兼容：analysis.js 仍以 ddgSearch 为名调用 */
async function ddgSearch(query, count) {
  return search(query, count);
}

/** 把检索结果格式化为喂给模型的上下文 */
function formatSearchContext(results) {
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${(r.snippet || "").slice(0, 160)}`)
    .join("\n\n");
}

module.exports = { search, ddgSearch, formatSearchContext };

