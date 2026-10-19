# 个人博客使用说明

> 地址：<https://chaosharm0212.github.io/blog/>
> 一句话概括：**文章是 Markdown，发布是 `git push`；没有构建、没有依赖、没有服务器。**

---

## 0. 三分钟上手

| 我想…… | 去哪里改 |
| --- | --- |
| 发一篇新文章 | `node tools/new-post.mjs "标题" --tags 前端,随笔`，然后改正文 |
| 改我的名字 / 邮箱 / 简介 | `assets/js/site.js`（**只改这一个文件**） |
| 改站名、首页大标题 | `assets/js/site.js` 的 `name` / `hero`（`<title>` 在 `index.html` 头部） |
| 换主色、换字体 | `assets/css/style.css` 开头 `:root` 里的设计令牌 |
| 加配图 | 图片丢进 `assets/img/`，正文写 `![描述](assets/img/图.png)` |
| 发布到线上 | `git add -A && git commit -m "..." && git push` |
| 确认线上正常 | `pwsh tools/check-live.ps1` |

---

## 1. 它是什么（30 秒理解）

这是一个**单页静态博客**：

```
blog/
├── index.html              ← 页面骨架 + 全部文章（Markdown 写在 <script type="text/markdown"> 块里）
├── assets/
│   ├── css/style.css       ← 全部样式（设计令牌在最前面）
│   ├── js/
│   │   ├── site.js         ← 你的个人信息、站点配置（改这个最多）
│   │   ├── markdown.js     ← Markdown 渲染 + 代码高亮
│   │   └── app.js          ← 路由、搜索、目录、主题
│   └── img/                ← 你自己的图片
├── tools/
│   ├── new-post.mjs        ← 新建文章
│   ├── build-feed.mjs      ← 生成 RSS
│   └── check-live.ps1      ← 部署后自检
├── feed.xml                ← RSS（由脚本生成，别手改）
├── robots.txt / .nojekyll
├── README.md / DEPLOY.md / GUIDE.md（本文）
```

三个关键事实：

1. **没有构建步骤。** 改完文件刷新浏览器就能看到效果，`git push` 就是发布。
2. **没有后端。** 搜索、目录、深浅色全在浏览器里算，所以托管成本是 0。
3. **路由用 hash。** 文章地址是 `#/post/slug` 这种形式。好处是任何静态托管都能跑、不需要服务器回退配置；代价是每篇文章对搜索引擎没有独立地址（详见第 9 节）。

---

## 2. 发一篇文章

### 方法 A：一条命令（推荐）

```powershell
cd C:\Users\Administrator\Desktop\ds_workspace\blog
node tools/new-post.mjs "如何优雅地写周报" --tags 随笔,职场
```

输出会告诉你插入到了第几篇、slug 是什么、地址是什么。然后：

1. 打开 `index.html`，搜索它给你的 `slug`（比如 `post-20261019`），把占位正文改成你的内容；
2. `node tools/build-feed.mjs` 更新 RSS；
3. `git add -A && git commit -m "新文章：如何优雅地写周报" && git push`。

可选参数：

```powershell
node tools/new-post.mjs "标题" --slug my-post --date 2026-01-01 --tags 前端,CSS --summary "一句话摘要"
```

- `--slug` 不填就按日期生成（`post-20261019`）；重名会自动加 `-2`
- `--date` 不填就是今天
- 这个脚本只插入模板，**不会**替你删掉占位正文

### 方法 B：手动复制模板

打开 `index.html`，找到文件末尾 `文章内容` 那段注释，复制一个块改掉：

```html
<script type="text/markdown">
---
title: 文章标题
slug: my-new-post
date: 2026-01-01
tags: [前端, 随笔]
summary: 一句话摘要，会出现在列表页、搜索结果和 RSS 里。
featured: false
---
正文就是普通 Markdown。

## 小标题

段落之间空一行。
</script>
```

### frontmatter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 标题，列表页和浏览器标签都用它 |
| `slug` | 是 | 文章地址 `#/post/<slug>`，**只能字母数字和连字符**，不能重复 |
| `date` | 是 | `YYYY-MM-DD`。列表按它倒序，归档页按年份分组，上下篇也按它排 |
| `tags` | 否 | `[前端, 随笔]` 这种中括号逗号写法，会生成标签页 |
| `summary` | 否 | 摘要，出现在列表、搜索面板、RSS 的 description |
| `featured` | 否 | `true` 会做两件真的：文章列表行与文章页显示「精选」标记，并且进入首页顶部的「精选」区（最多 3 篇）。被选进精选的文章不会重复出现在下面的「更多文章」里 |

### 三条硬性规则

1. **slug 唯一**，且只能 `a-z 0-9 -`（它出现在网址里，中文会变成乱码）；
2. **正文里不能出现 `</script` 和 `<!--`**——浏览器会把它们当成脚本文本的结束符，整页会白屏。要讲这类代码就写成"一个 script 标签"或者用 `&lt;` 转义；
3. **不要用 `#` 写一级标题**，正文从 `##` 开始（`#` 会渲染成没有样式的 H1，而且不进目录）。

### 新文章自检清单

- [ ] 首页能看到它（最新 5 篇，更早的在"全部文章"）
- [ ] 点进去能打开，标题、目录、代码块正常
- [ ] 标签能筛选到
- [ ] `Ctrl + K` 能搜到（搜索覆盖标题、摘要、标签和正文）
- [ ] `node tools/build-feed.mjs` 跑过了（RSS 里有它）

---

## 3. 正文能写什么（Markdown 速查）

### 基础

| 写法 | 效果 |
| --- | --- |
| `## 二级标题` / `### 三级标题` | 正文小标题，会自动进右侧目录 |
| 空一行 | 分段（**必须空行**，否则会被当成同一段的换行） |
| `**加粗**` / `*斜体*` / `~~删除线~~` | 强调 |
| `` `行内代码` `` | 等宽小色块 |
| `[文字](https://example.com)` | 外链，自动新窗口打开 |
| `[全部文章](#/posts)` | 站内跳转（路由地址） |
| `> 引用` | 带强调色左边线的引用块 |
| `---` | 一条分隔线（居中三个点） |
| `- 列表` / `1. 有序列表` | 列表，缩进 2 空格可嵌套 |
| `- [ ] 待办` / `- [x] 做完` | 任务列表（显示 ☐ / ☑） |

### 表格

```markdown
| 阶段 | 耗时 | 结论 |
| --- | --- | --- |
| 优化前 | 4.2s | 字体阻塞 |
| 优化后 | 1.1s | —— |
```

### 代码块

````markdown
```js
const a = 1;
```
````

- 会渲染成深色代码面板，带语言标签和**复制按钮**；
- 语言标签决定高亮规则，支持：`js` `ts` `jsx` `tsx` `json` `css` `scss` `html` `vue` `sql` `bash` `sh` `py` `go` `rust` `java`，其他语言按纯文本显示；
- 也可以用 `~~~js` 开头结尾（当正文里需要出现三个反引号时更方便）。

### 图片

```markdown
![架构图](assets/img/arch.png)
![架构图](assets/img/arch.png "鼠标悬停时显示的文字")
```

**用相对路径**（`assets/img/...`），不要用 `/assets/...`——因为线上部署在 `/blog/` 子目录下，绝对路径会 404。

### 不支持的东西

| 写法 | 现状 |
| --- | --- |
| 原生 HTML（`<kbd>`、`<br>`、`<div>`） | 会被**转义成文字**显示，不生效 |
| 脚注 `[^1]` | 不支持 |
| 单下划线斜体 `_文本_` | 不支持，请用 `*文本*` |
| 目录/面板里的自动编号 | 由页面自动生成，不用自己写 |

---

## 4. 改个人信息（`assets/js/site.js`）

**身份相关只在这里写一次**，页头品牌、页脚、版权年份、关于页、RSS 与 canonical 全都读它。

| 字段 | 作用 | 现在的内容 |
| --- | --- | --- |
| `name` / `latin` | 站名与副标（页头、页脚、标签页标题） | 知微 / ZHIWEI |
| `url` | 站点地址，RSS 和 canonical 用它，结尾保留 `/` | `https://chaosharm0212.github.io/blog/` |
| `author` / `monogram` | 页脚版权署名、头像圆里的那个字 | 温冷默临 / 临 |
| `role` / `bio` | 侧栏"关于"卡片 | AI 爱好者 / 写作者 |
| `email` / `links` | 联系方式（页脚与关于页都渲染它，RSS 链接自动追加） | 已填你的邮箱与 GitHub |
| `kicker` / `hero` / `lede` | 首页导语与大标题 | 「把想清楚的**事**写下来。」 |
| `aboutLede` | 关于页大标题下面那句导语 | 一个热爱思考的人，和一个不太勤快的博客。 |
| `now` | 侧栏"最近"三条 | 换成你正在做的事 |
| `intro` / `timeline` / `stack` | 关于页自我介绍、年表、技能栈 | 已换成你自己的 |
| `footerNote` / `buildNote` | 页脚一句话与右下角说明 | —— |

> 改文案后的检查顺序：刷新本地页面看文字 → `node tools/build-feed.mjs`（如果改了 `lede` / 站名，RSS 描述会变）→ `git push`。
>
> 关于页的 `intro` 有固定的排版规则：**第一段**自动变成"引子"（宋体、字号略大、墨色略深），**其余段落**收进带竖线的引文块。
> 三段都支持 `**强调**`、`` `代码` ``、`[链接](url)`——强调会显示成陶土色，想突出某个词直接加 `**` 就行。

`index.html` 的 `<head>` 里还有三处静态文字需要手动同步（首帧前就要用，JS 填不进去）：`<title>`、`<meta name="description">`、`og:*`。

---

## 5. 改外观

样式全部在 `assets/css/style.css`，**开头 60 行是设计令牌**，改这里最安全：

```css
:root {
  --paper: #fbfaf7;      /* 纸面底色 */
  --ink: #17181b;        /* 正文颜色 */
  --accent: #ad4a22;     /* 强调色（陶土红）：链接、当前章节、分隔线 */
  --font-display: ...;   /* 标题字体（宋体系） */
  --font-body: ...;      /* 正文字体（系统黑体） */
  --font-mono: ...;      /* 代码字体 */
  --maxw: 1120px;        /* 内容最大宽度 */
  --gutter: clamp(20px, 5vw, 48px);  /* 左右留白 */
}
[data-theme="dark"] { /* 深色模式对应值，改颜色时两边都要改 */ }
```

常见改法：

- **换主色**：同时改 `--accent`、`--accent-2`、`--accent-soft`（深色主题里那三个也改）；
- **换成蓝灰调**：`--accent: #2f5d8a; --accent-soft: rgba(47,93,138,.08)`；
- **标题不用宋体**：把 `--font-display` 改成和 `--font-body` 一样；
- **内容更宽**：`--maxw: 1280px`（阅读列宽在 `.post-grid` 里单独控制，`640px`）。

不建议改的部分：`.code` 系列（代码面板）、`.palette` 系列（搜索面板）、`.prose` 里的排版规则——它们互相咬合得比较紧。

---

## 6. 加图片

1. 在 `assets/img/` 下放图片（目录已存在可自建）；
2. 正文写 `![描述](assets/img/文件名.png)`；
3. 描述（alt）要写，它同时是图片加载失败时的替代文字，对无障碍也重要。

建议：宽度不超过 1600px，单张压到 200KB 以内（SVG 或 WebP 更好）。**站点不会自动压缩图片**，原图多大就传多大。

---

## 7. 本地预览

```powershell
# 方式一：直接双击 index.html（file://，hash 路由可用）
# 方式二：起个本地服务器，地址更干净
cd C:\Users\Administrator\Desktop\ds_workspace\blog
python -m http.server 8080

# 方式三：让手机在同一个 Wi-Fi 下看
python -m http.server 8080 --bind 0.0.0.0
# 再查 ipconfig 里的 IPv4，手机访问 http://192.168.x.x:8080
```

`file://` 下有两个限制（线上正常）：剪贴板 API 不可用（复制按钮会走兼容方案）、`fetch` 不可用（所以文章才内嵌在 HTML 里）。

---

## 8. 发布、回滚、换域名

### 日常发布

```powershell
git add -A
git commit -m "新文章：xxx"
git push
pwsh tools/check-live.ps1        # 可选，确认线上 7 项探测都 200
```

推送后约 30 秒生效。看构建进度：仓库 **Actions** → `pages build and deployment`。

### 回滚

```powershell
git revert HEAD          # 生成一个反向提交，最安全
git push
```

改坏了想整体退回到某个版本：`git log --oneline` 找到哈希，`git revert <hash>`（不要对已推送的分支用 `reset --hard`）。

### 换域名

1. 域名 DNS 加 `CNAME` 记录指向 `chaosharm0212.github.io`；
2. 仓库 Settings → Pages → Custom domain 填域名（勾 Enforce HTTPS）；
3. `assets/js/site.js` 的 `url` 改成新域名（结尾 `/`）；
4. `index.html` 头部的 canonical 换成新域名；
5. `node tools/build-feed.mjs` 重新生成 RSS；
6. 提交推送，跑一次 `pwsh tools/check-live.ps1`。

---

## 9. 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 推了但线上没变 | 等 30 秒；`Ctrl + F5` 强刷；看 Actions 是否还在跑 |
| 整页白屏 | 正文里出现了 `</script` 或 `<!--`，把它们删掉或改写 |
| 新文章 404 | slug 拼错 / 与旧文章重复；用标签页或搜索确认它是否被解析到 |
| RSS 缺新文章 | 忘了跑 `node tools/build-feed.mjs` |
| 搜索搜不到新文章 | 搜索索引在页面加载时构建，刷新一次即可 |
| 图片不显示 | 用了 `/assets/...` 绝对路径，改成 `assets/...`；或文件名大小写不一致（服务器区分大小写，Windows 不区分） |
| `git push` 报 `Connection was reset` | 代理没生效。仓库里已配 `http.proxy`；若代理端口变了：`git config http.proxy http://127.0.0.1:新端口` |
| push 被拒（non-fast-forward） | 远程有本地没有的提交：`git pull --rebase origin main` 再 push |
| 想删一篇文章 | 删掉整个 `<script type="text/markdown">` 块，跑 build-feed，提交 |

**关于 SEO**：因为地址是 `/#/post/slug`，`#` 之后不会被搜索引擎单独收录，整站对搜索而言基本只有一个入口。这是"无构建 + 无服务器"的代价。真在意搜索流量，可以把 hash 路由换成真实路径（每篇一个 `.html`），界面完全不用动——那是另一次改造。

---

## 10. 快捷键与隐藏功能

| 操作 | 效果 |
| --- | --- |
| `Ctrl + K` / `⌘ + K` | 打开搜索面板（标题、摘要、标签、正文全文） |
| `/` | 同样打开搜索（焦点不在输入框时） |
| `↑ ↓` + `Enter` | 搜索结果键盘选择与打开 |
| `Esc` | 关闭搜索面板 |
| 点目录项 | 平滑滚动到对应章节，目录会跟着高亮当前章节 |
| 点代码块右上角"复制" | 复制该段代码 |
| 右上角月亮/太阳 | 切换深浅色，选择会记住 |
| 顶部细线 | 阅读进度条（只在文章页出现） |
| 右下角圆形按钮 | 回到顶部 |

---

## 11. 备份与迁移

**备份有三份**：本地这个文件夹、GitHub 仓库、以及任何一台 `git clone` 过的机器。内容全在仓库里，没有数据库、没有后台。

**迁移到正式框架**（Astro / Next / Eleventy）成本很低：文章已经是标准 Markdown + frontmatter，把 `index.html` 里的每个 `<script type="text/markdown">` 块拆成一个 `.md` 文件即可；`app.js` 里的 `viewHome` / `viewPost` / `viewPosts` 也可以直接改写成组件。

---

## 12. 命令速查

```powershell
# 新建文章
node tools/new-post.mjs "标题" --tags 前端,随笔

# 只生成 RSS（加了文章、或改了站点 url 之后）
node tools/build-feed.mjs

# 本地预览
python -m http.server 8080

# 发布
git add -A; git commit -m "新文章：xxx"; git push

# 线上自检
pwsh tools/check-live.ps1

# 看最近的提交
git log --oneline -5
```
