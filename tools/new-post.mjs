#!/usr/bin/env node
/**
 * 新建一篇文章：往 index.html 里插入一个 Markdown 文章块
 * ---------------------------------------------------------------------------
 * 用法：
 *   node tools/new-post.mjs "我的文章标题"
 *   node tools/new-post.mjs "我的文章标题" --tags 前端,随笔 --slug my-post
 *   node tools/new-post.mjs "标题" --date 2026-01-01 --summary "一句摘要"
 *
 * 默认行为：
 *   slug    = post-年月日（重名自动加 -2）
 *   date    = 今天
 *   tags    = 空
 *   summary = 占位提示，记得改
 *
 * 插入位置在 <script src="assets/js/site.js"> 之前，也就是最后一个文章块的后面。
 * 生成后还要：① 改正文 ② 跑 tools/build-feed.mjs ③ git 提交
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "index.html");
const ANCHOR = '<script src="assets/js/site.js"></script>';

/* ------------------------------------------------------------ 解析参数 */
const argv = process.argv.slice(2);
if (!argv.length || argv[0].startsWith("--")) {
  console.error('用法：node tools/new-post.mjs "文章标题" [--slug xxx] [--tags 前端,随笔] [--date 2026-01-01] [--summary "..."]');
  process.exit(1);
}

const title = argv[0];
const opts = {};
for (let i = 1; i < argv.length; i++) {
  const key = argv[i];
  if (!key.startsWith("--")) continue;
  const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "";
  opts[key.slice(2)] = value;
}

if (!title.trim()) {
  console.error("标题不能为空");
  process.exit(1);
}

const today = new Date();
const stamp =
  today.getFullYear().toString() +
  String(today.getMonth() + 1).padStart(2, "0") +
  String(today.getDate()).padStart(2, "0");

const date = (opts.date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`).trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`日期格式应为 YYYY-MM-DD，收到的是：${date}`);
  process.exit(1);
}

const tags = (opts.tags || "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const summary = (opts.summary || "一句话摘要：会出现在文章列表、搜索结果和 RSS 里。").trim();

/* ------------------------------------------------------- 处理 index.html */
const html = readFileSync(INDEX, "utf8");

if (!html.includes(ANCHOR)) {
  console.error(`在 index.html 里找不到插入位置（${ANCHOR}），文件被改过？`);
  process.exit(1);
}

/* 重名检查：把已有的 slug 都读出来 */
const existing = [...html.matchAll(/^\s*slug:\s*(.+)$/gm)].map((m) => m[1].trim());
let slug = (opts.slug || `post-${stamp}`).trim();
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
  console.error(`slug 只能用字母、数字和连字符（它出现在地址里）：${slug}`);
  process.exit(1);
}
if (existing.includes(slug)) {
  let n = 2;
  while (existing.includes(`${slug}-${n}`)) n++;
  console.warn(`slug "${slug}" 已存在，改用 "${slug}-${n}"`);
  slug = `${slug}-${n}`;
}

const block = `<script type="text/markdown">
---
title: ${title}
slug: ${slug}
date: ${date}
tags: [${tags.join(", ")}]
summary: ${summary}
---
在这里写正文。这一行删掉也行。

## 第一个小标题

正文用 **加粗**、\`行内代码\`、[链接](https://example.com)。

\`\`\`js
// 代码块记得写语言，会高亮并带复制按钮
console.log("hello");
\`\`\`

## 第二个小标题

段落之间空一行。
</script>

`;

const updated = html.replace(ANCHOR, block + ANCHOR);
writeFileSync(INDEX, updated, "utf8");

const order = existing.length + 1;
console.log(`
已插入第 ${order} 篇文章
  标题：${title}
  slug：${slug}    → 地址 #/post/${slug}
  日期：${date}
  标签：${tags.length ? tags.join("、") : "（无）"}

接下来：
  1. 打开 index.html，搜索 "${slug}"，把占位正文改成你的内容
  2. node tools/build-feed.mjs        更新 RSS
  3. git add -A && git commit -m "新文章：${title}" && git push
`);
