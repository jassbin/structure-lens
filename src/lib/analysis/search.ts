import "server-only";

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
 * 免 key 的 DuckDuckGo HTML 搜索（server-only）。
 * 解析 html.duckduckgo.com 的结果块，返回前若干条。失败时返回空数组，绝不抛断整个流程。
 */
export async function ddgSearch(query: string, limit = 6): Promise<SearchResult[]> {
  // 先试 lite 端点（更抗封锁、更易解析），失败再退回 html 端点
  const lite = await ddgLite(query, limit);
  if (lite.length > 0) return lite;
  return ddgHtml(query, limit);
}

/** lite.duckduckgo.com/lite/ —— 表格式结果，最耐爬 */
async function ddgLite(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({ q: query }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    const html = await res.text();
    console.log(`[ddg-lite] status=${res.status} htmlLen=${html.length}`);

    const results: SearchResult[] = [];
    // 结果链接：<a rel="nofollow" href="..." class="result-link">Title</a>
    const linkRe =
      /<a[^>]*class="[^"]*result-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    // 摘要：<td class="result-snippet">...</td>
    const snippetRe = /<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/g;

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
  } catch {
    return [];
  }
}

/** html.duckduckgo.com/html/ 回退 */
async function ddgHtml(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
      body: new URLSearchParams({ q: query, kl: "cn-zh" }).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    const html = await res.text();
    console.log(`[ddg-html] status=${res.status} htmlLen=${html.length}`);

    const results: SearchResult[] = [];
    // 结果链接
    const linkRe =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe =
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

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
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] ?? "",
      });
    }
    return results;
  } catch {
    return [];
  }
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
