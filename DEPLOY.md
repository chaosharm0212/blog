# 怎么让别人访问你的博客

现在这个站点只在你自己的电脑上：双击 `index.html` 打开的是 `file://` 地址，只有你能看。
要让别人看，只有一件事要做——**把这几个文件放到一个别人能访问的地址上**。

好消息是：这个站是纯静态的（HTML + CSS + JS，没有后端、没有构建），所以任何静态托管都能用。
而且它用了 hash 路由（`#/post/xxx`）和相对路径（`assets/css/style.css`），意味着：

- 放在根目录（`https://example.com/`）能跑；
- 放在子目录（`https://你的名字.github.io/blog/`）也能跑；
- **不需要**配置任何「404 回退 / rewrite 规则」——这条是很多前端项目部署时最容易踩的坑，你没有。

---

## 四条路线，按「从快到正式」排列

| 路线 | 别人怎么访问 | 成本 | 需要备案 | 适合 |
| --- | --- | --- | --- | --- |
| 同一 Wi-Fi 预览 | `http://你的内网IP:8080` | 0 | 不需要 | 当面给同事、家人看 |
| 临时公网隧道 | `https://xxx.trycloudflare.com` | 0 | 不需要 | 发给朋友看两天，立即生效 |
| GitHub Pages / Netlify / Vercel | `https://xxx.github.io/blog/` | 0 | 不需要 | **长期用的推荐方案** |
| 国内云对象存储（OSS / COS） | 自己的域名 | 几元/月起 | **需要 ICP 备案** | 面向国内访客、要求速度 |

---

## 路线一：先给同一个 Wi-Fi 里的人看（1 分钟）

在 `blog` 目录下起一个静态服务器：

```powershell
cd C:\Users\Administrator\Desktop\ds_workspace\blog
python -m http.server 8080 --bind 0.0.0.0
```

然后查出你的内网 IP：

```powershell
ipconfig | Select-String "IPv4"
```

别人在同一 Wi-Fi 下访问 `http://192.168.x.x:8080/` 即可。
第一次可能被 Windows 防火墙拦下来，弹窗时选「允许」。

> 关掉命令行窗口，地址就失效了。这是预览，不是发布。

## 路线二：临时挂到公网（5 分钟，不用域名）

用 Cloudflare Tunnel 的临时通道，不需要注册、不需要域名：

```powershell
# 装一次
winget install --id Cloudflare.cloudflared

# 起隧道（保持这个窗口开着）
cloudflared tunnel --url http://localhost:8080
```

它会打印一个 `https://随机词.trycloudflare.com` 的地址，直接发给别人就能打开。
隧道进程一停，地址就失效——适合「给朋友看一眼」或者临时评审。

同类工具：`ngrok http 8080`、`npx localtunnel --port 8080`。

## 路线三：GitHub Pages（推荐，长期免费）

**仓库已经初始化好了**，本地有一个 `main` 分支和第一次提交，你只差建远程仓库再推：

```powershell
# 1. 在 github.com 上新建一个空仓库，名字建议就叫 blog（不要勾选 README / 协议）
# 2. 在本地把远程接上并推送
cd C:\Users\Administrator\Desktop\ds_workspace\blog
git remote add origin https://github.com/chaosharm0212/blog.git
git push -u origin main
```

然后在这个仓库页面：**Settings → Pages → Source 选 "Deploy from a branch" → Branch 选 `main` / `(root)` → Save**。

等 1 分钟左右，访问：

- 仓库名是 `blog` 时：`https://chaosharm0212.github.io/blog/`
- 仓库名是 `chaosharm0212.github.io` 时：`https://chaosharm0212.github.io/`

几个细节：

- `.gitignore`、`.nojekyll` 都已经就位，不需要额外配置；
- 自定义域名：在 Pages 里填域名，然后在你域名的 DNS 里加一条 `CNAME` 指向 `chaosharm0212.github.io`；
- 之后更新文章只需要在 `blog` 目录里 `git add . && git commit -m "新文章" && git push`，几十秒后自动生效。

### 更省事的等价方案

- **Netlify（最快）**：打开 `app.netlify.com/drop`，把整个 `blog` 文件夹拖进去，30 秒得到一个
  `https://xxx.netlify.app` 地址。
- **Cloudflare Pages / Vercel**：连接这个 GitHub 仓库，**构建命令留空**、输出目录填仓库根（`.`），
  以后每次 push 自动发布。

## 路线四：国内云（要不要备案，先看清楚）

阿里云 OSS、腾讯云 COS、七牛都支持「静态网站托管」，上传文件、开一下静态网站功能即可。但有两条硬限制：

1. **自定义域名 + 中国大陆节点必须完成 ICP 备案**，没有备案域名，国内节点不能对外提供网页访问；
2. **对象存储的默认域名（`xxx.oss-cn-hangzhou.aliyuncs.com`）访问 HTML 时会被强制下载**，
   不能直接在浏览器里打开——这是最常见的踩坑点。

所以国内云只有两种可行组合：

- 备案过的域名 + 国内节点（速度最好，但要备案，耗时约 1–3 周）；
- 不备案域名 + 香港/海外节点（能立刻用，国内访问速度一般）。

如果你的读者主要在国内、又不打算折腾备案，最实际的选择是：**GitHub Pages 起步，等真的有读者了再考虑备案域名**。

---

## 发布之后必做两步

1. 把 `assets/js/site.js` 里的 `url` 改成你的真实地址（例如 `https://chaosharm0212.github.io/blog/`，
   结尾保留 `/`）——RSS 与 `<link rel="canonical">` 都读它；
2. 跑一次 `node tools/build-feed.mjs` 重新生成 `feed.xml`，让订阅源里的链接指向线上地址。

订阅地址就是站点根目录下的 `/feed.xml`，可以直接丢进 Feedly、Inoreader、NetNewsWire 之类的阅读器。
以后每加一篇文章，跑一次这个脚本即可（它读的就是网页用的那份 Markdown，不会出现两边不一致）。

## 发布之后要检查的三件事

一次跑完下面这条，就能把首页、样式、脚本、RSS、robots.txt 全部探测一遍：

```powershell
pwsh tools/check-live.ps1
# 或指定地址： pwsh tools/check-live.ps1 -Url https://example.com/blog/
```

它会自动读取本仓库 git 配置里的代理，避免 curl 直连被重置导致误判。全部 200 就说明可以用
`https://chaosharm0212.github.io/blog/` 把链接发出去了。

1. **打开的是 `https://` 而不是 `http://`**：GitHub Pages / Cloudflare / Netlify 都自动带证书；
2. **深色模式、搜索、目录都正常**：它们是纯前端能力，不依赖服务器，托管后行为和在本地一致；
3. **换到新地址后，浏览器可能有缓存**：改完文章如果看不到更新，`Ctrl + F5` 强刷一次。

## 一点点建议

- 别急着买域名。先用 GitHub Pages 的免费地址把文章写起来，等你确认自己会持续更新，再绑域名；
- 署名、邮箱、社交链接都在 `assets/js/site.js` 一处，换起来只改一个文件；
- 如果只想给特定几个人看（不公开），GitHub Pages 有私有仓库 + 访问控制的企业方案，但对个人最省事的做法是
  用路线二的临时隧道，或者干脆发 HTML 文件给对方。
