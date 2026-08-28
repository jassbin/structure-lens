import "server-only";
import { execFile } from "node:child_process";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 解码常见 HTML 实体 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

/** DuckDuckGo 真实链接可能被包成重定向，解出真实 url */
function unwrapDdgUrl(href: string): string {
  try {
    if (href.startsWith("//")) href = "https:" + href;
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

/**
 * 通过系统 curl（HTTP/1.1）抓取，避开 undici fetch 被 DuckDuckGo 判为异常（202 空页）的问题。
 * curl 不可用时回退到内置 fetch。
 */
function curlPost(url: string, body: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      "curl",
      [
        "-s",
        "--max-time",
        "9",
        "-A",
        "Mozilla/5.0",
        "-X",
        "POST",
        "--data",
        body,
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => resolve(err ? "" : stdout),
    );
  });
}

async function fetchPost(url: string, body: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    return await res.text();
  } catch {
    return "";
  }
}

async function getPage(url: string, body: string): Promise<string> {
  const viaCurl = await curlPost(url, body);
  // 202 异常页约 14KB 且不含结果标记；curl 拿到正常页才算成功
  if (viaCurl && /result-link|result__a/.test(viaCurl)) return viaCurl;
  const viaFetch = await fetchPost(url, body);
  if (viaFetch && /result-link|result__a/.test(viaFetch)) return viaFetch;
  return viaCurl || viaFetch;
}

function parse(
  html: string,
  linkRe: RegExp,
  snippetRe: RegExp,
  limit: number,
): SearchResult[] {
  const results: SearchResult[] = [];
  const links: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < limit) {
    links.push({ url: unwrapDdgUrl(m[1]), title: stripTags(m[2]) });
  }
  const snippets: string[] = [];
  let s: RegExpExecArray | null;
  while ((s = snippetRe.exec(html)) && snippets.length < limit) {
    snippets.push(stripTags(s[1]));
  }
  for (let i = 0; i < links.length; i++) {
    if (!links[i].title) continue;
    results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] ?? "" });
  }
  return results;
}

/**
 * 免 key 的 DuckDuckGo 搜索（server-only）。先试 lite 端点，再试 html 端点。
 * 失败一律返回空数组，绝不抛断分析流程（对齐步骤会据此让用户手动确认）。
 */
export async function ddgSearch(query: string, limit = 6): Promise<SearchResult[]> {
  const liteHtml = await getPage(
    "https://lite.duckduckgo.com/lite/",
    new URLSearchParams({ q: query }).toString(),
  );
  const lite = parse(
    liteHtml,
    /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    /<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/g,
    limit,
  );
  if (lite.length > 0) return lite;

  const fullHtml = await getPage(
    "https://html.duckduckgo.com/html/",
    new URLSearchParams({ q: query, kl: "cn-zh" }).toString(),
  );
  return parse(
    fullHtml,
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    limit,
  );
}

/** 把搜索结果拼成给模型的资料块 */
export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return "（未搜索到相关资料）";
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n来源：${r.url}\n摘要：${r.snippet || "（无摘要）"}`,
    )
    .join("\n\n");
}
