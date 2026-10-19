#!/usr/bin/env node
/**
 * 生成 feed.xml（RSS 2.0）
 * ---------------------------------------------------------------------------
 * 数据来源就是 index.html 里的 Markdown 文章块——和页面用的是同一份内容、同一个
 * Markdown 解析器，所以不会出现「网页更新了、RSS 还是旧的」这种情况。
 *
 * 用法（加完文章后跑一次）：
 *   node tools/build-feed.mjs
 *
 * 需要 Node 18+，不装任何依赖。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------ 复用浏览器端的两个模块 */
function windowOf(file) {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, file), "utf8"), sandbox);
  return sandbox.window;
}

const SITE = windowOf("assets/js/site.js").SITE;
const MD = windowOf("assets/js/markdown.js").MD;

/* ------------------------------------------------------------ 解析文章 */
function parseFrontmatter(text) {
  const src = String(text).replace(/\r\n?/g, "\n");
  const m = /^\s*---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { attrs: {}, body: src };

  const attrs = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0 || /^\s*#/.test(line)) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    if (key) attrs[key] = value;
  }
  return { attrs, body: src.slice(m[0].length) };
}

const html = readFileSync(join(ROOT, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const blocks = [...html.matchAll(/<script type="text\/markdown">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const posts = blocks
  .map((raw) => {
    const { attrs, body } = parseFrontmatter(raw);
    if (!attrs.slug) return null;
    return {
      slug: attrs.slug,
      title: attrs.title || "未命名",
      summary: attrs.summary || "",
      date: String(attrs.date || ""),
      tags: Array.isArray(attrs.tags) ? attrs.tags : attrs.tags ? [attrs.tags] : [],
      html: MD.render(body)
    };
  })
  .filter(Boolean)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/* -------------------------------------------------------------- 工具 */
const BASE = String(SITE.url || "").replace(/\/?$/, "/");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const cdata = (s) => "<![CDATA[" + String(s).replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";

/** 2025-11-26 → Wed, 26 Nov 2025 00:00:00 +0800 */
function rfc822(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${pad(d)} ${MONTHS[m - 1]} ${y} 00:00:00 +0800`;
}

function now822() {
  const n = new Date();
  return (
    `${DAYS[n.getUTCDay()]}, ${pad(n.getUTCDate())} ${MONTHS[n.getUTCMonth()]} ${n.getUTCFullYear()} ` +
    `${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} +0000`
  );
}

const itemUrl = (slug) => BASE + "#/post/" + encodeURIComponent(slug);

/* -------------------------------------------------------------- 输出 */
const items = posts
  .map((p) => {
    const url = itemUrl(p.slug);
    return [
      "  <item>",
      `    <title>${esc(p.title)}</title>`,
      `    <link>${esc(url)}</link>`,
      `    <guid isPermaLink="false">${esc(url)}</guid>`,
      `    <pubDate>${rfc822(p.date)}</pubDate>`,
      p.summary ? `    <description>${esc(p.summary)}</description>` : "",
      p.tags.map((t) => `    <category>${esc(t)}</category>`).join("\n"),
      `    <content:encoded>${cdata(p.html)}</content:encoded>`,
      "  </item>"
    ]
      .filter(Boolean)
      .join("\n");
  })
  .join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${esc(SITE.name || "")}</title>
  <link>${esc(BASE)}</link>
  <description>${esc(SITE.lede || SITE.kicker || "")}</description>
  <language>zh-CN</language>
  <lastBuildDate>${now822()}</lastBuildDate>
  <generator>tools/build-feed.mjs</generator>
  <atom:link href="${esc(BASE + "feed.xml")}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;

writeFileSync(join(ROOT, "feed.xml"), feed, "utf8");

console.log(`feed.xml 已生成：${posts.length} 篇文章`);
console.log(`站点地址：${BASE}`);
console.log(`最新：${posts[0] ? posts[0].date + " " + posts[0].title : "（没有文章）"}`);
if (/example\.(com|org)|localhost|127\.0\.0\.1/.test(BASE)) {
  console.warn("⚠  SITE.url 看起来还是占位地址，记得在 assets/js/site.js 里改成真实域名");
}
