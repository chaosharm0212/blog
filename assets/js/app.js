/* =========================================================================
   应用层：路由 / 视图 / 搜索面板 / 目录 / 阅读进度 / 主题
   -------------------------------------------------------------------------
   无依赖、无构建。所有文章以 text/markdown 脚本块的形式写在 index.html 里，
   这里负责解析 frontmatter、渲染页面并接管交互。
   ========================================================================= */
(function () {
  "use strict";

  var MD = window.MD;
  var SITE = window.SITE || {};
  var esc = MD.escapeHtml;

  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var main = $("#main");
  var header = $("#siteHeader");
  var progressBar = $("#progress");
  var toTopBtn = $("#toTop");

  var state = {
    route: { name: "home" },
    query: "",
    tag: "",
    spy: null
  };

  /* ------------------------------------------------------------- 工具 */
  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toDate(iso) {
    return new Date(String(iso) + "T00:00:00");
  }

  function fmtDate(iso) {
    var d = toDate(iso);
    return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  }

  function fmtShort(iso) {
    var d = toDate(iso);
    return d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate());
  }

  function countWords(text) {
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var latin = (text.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latin * 2;
  }

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function tagLink(tag) {
    return '<a class="tag" href="#/tag/' + encodeURIComponent(tag) + '">' + esc(tag) + "</a>";
  }

  /* --------------------------------------------------- 解析文章内容 */
  function parseFrontmatter(text) {
    var src = String(text || "").replace(/\r\n?/g, "\n");
    var m = /^\s*---\n([\s\S]*?)\n---\n?/.exec(src);
    if (!m) return { attrs: {}, body: src };

    var attrs = {};
    m[1].split("\n").forEach(function (line) {
      var idx = line.indexOf(":");
      if (idx < 0 || /^\s*#/.test(line)) return;
      var key = line.slice(0, idx).trim();
      var value = line.slice(idx + 1).trim();

      if (/^\[.*\]$/.test(value)) {
        value = value
          .slice(1, -1)
          .split(",")
          .map(function (s) {
            return s.trim().replace(/^["']|["']$/g, "");
          })
          .filter(Boolean);
      } else if (value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else {
        value = value.replace(/^["']|["']$/g, "");
      }
      if (key) attrs[key] = value;
    });

    return { attrs: attrs, body: src.slice(m[0].length) };
  }

  var POSTS = $$('script[type="text/markdown"]')
    .map(function (el) {
      var parsed = parseFrontmatter(el.textContent);
      var attrs = parsed.attrs;
      var plain = MD.plain(parsed.body);
      var words = countWords(plain);
      return {
        slug: attrs.slug || el.getAttribute("data-slug") || slugify(attrs.title || ""),
        title: attrs.title || "未命名",
        summary: attrs.summary || "",
        date: String(attrs.date || "2024-01-01"),
        tags: Array.isArray(attrs.tags) ? attrs.tags : attrs.tags ? [attrs.tags] : [],
        featured: attrs.featured === true,
        html: MD.render(parsed.body),
        plain: plain,
        words: words,
        minutes: Math.max(1, Math.round(words / 380))
      };
    })
    .filter(function (p) {
      return p.slug;
    })
    .sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });

  var TAG_MAP = {};
  POSTS.forEach(function (p) {
    p.tags.forEach(function (t) {
      TAG_MAP[t] = TAG_MAP[t] || [];
      TAG_MAP[t].push(p);
    });
  });

  var TAGS = Object.keys(TAG_MAP).sort(function (a, b) {
    return TAG_MAP[b].length - TAG_MAP[a].length || (a < b ? -1 : 1);
  });

  function tagCount(name) {
    return TAG_MAP[name] ? TAG_MAP[name].length : 0;
  }

  /* --------------------------------------------------------- 组件 */
  function postRow(p, index) {
    return (
      '<li class="row">' +
      '<span class="row__num">' +
      pad2(index + 1) +
      "</span>" +
      '<div class="row__body">' +
      '<h3 class="row__title"><a class="row__link" href="#/post/' +
      encodeURIComponent(p.slug) +
      '">' +
      esc(p.title) +
      "</a></h3>" +
      '<p class="row__summary">' +
      esc(p.summary) +
      "</p>" +
      '<div class="row__meta">' +
      "<time datetime=" +
      JSON.stringify(p.date) +
      ">" +
      fmtShort(p.date) +
      "</time>" +
      '<span class="dot">·</span><span>' +
      p.minutes +
      " 分钟</span>" +
      '<span class="dot">·</span>' +
      '<span class="row__tags">' +
      p.tags.map(tagLink).join("") +
      "</span>" +
      "</div></div>" +
      '<span class="row__arrow" aria-hidden="true">→</span>' +
      "</li>"
    );
  }

  function archiveHtml(posts) {
    if (!posts.length) return "";
    var groups = [];
    posts.forEach(function (p) {
      var year = p.date.slice(0, 4);
      var last = groups[groups.length - 1];
      if (!last || last.year !== year) {
        groups.push({ year: year, items: [] });
      }
      groups[groups.length - 1].items.push(p);
    });

    return groups
      .map(function (g) {
        return (
          '<section class="year">' +
          '<h2 class="year__label">' +
          g.year +
          "</h2>" +
          '<ol class="rows">' +
          g.items
            .map(function (p, i) {
              return postRow(p, i);
            })
            .join("") +
          "</ol></section>"
        );
      })
      .join("");
  }

  function aboutCard() {
    var links = (SITE.links || [])
      .map(function (l) {
        return '<a class="mini-link" href="' + esc(l.href) + '">' + esc(l.label) + "</a>";
      })
      .join("");

    return (
      '<div class="card about-card">' +
      '<p class="card__label">关于</p>' +
      '<div class="about-card__head">' +
      '<span class="monogram" aria-hidden="true">' +
      esc(SITE.monogram || "文") +
      "</span>" +
      "<div>" +
      '<p class="about-card__name">' +
      esc(SITE.author || "") +
      "</p>" +
      '<p class="about-card__role">' +
      esc(SITE.role || "") +
      "</p>" +
      "</div></div>" +
      '<p class="about-card__bio">' +
      esc(SITE.bio || "") +
      "</p>" +
      '<div class="link-row">' +
      links +
      "</div></div>"
    );
  }

  function tagsCard() {
    var chips = TAGS.slice(0, 10)
      .map(function (t) {
        return (
          '<a class="tag" href="#/tag/' +
          encodeURIComponent(t) +
          '">' +
          esc(t) +
          ' <span class="n">' +
          tagCount(t) +
          "</span></a>"
        );
      })
      .join("");
    return (
      '<div class="card">' +
      '<p class="card__label">标签</p>' +
      '<div class="tags-cloud">' +
      chips +
      "</div></div>"
    );
  }

  function nowCard() {
    var items = (SITE.now || [])
      .map(function (item) {
        return "<li>" + esc(typeof item === "string" ? item : item.text) + "</li>";
      })
      .join("");
    return (
      '<div class="card">' +
      '<p class="card__label">最近</p>' +
      '<ul class="now-list">' +
      items +
      "</ul></div>"
    );
  }

  function navBind() {
    var current =
      state.route.name === "post" ? "posts" : state.route.name === "tag" ? "tags" : state.route.name;

    $$("[data-nav]").forEach(function (a) {
      if (a.getAttribute("data-nav") === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  /* --------------------------------------------------------- 视图 */
  function viewHome() {
    var latest = POSTS.slice(0, 5);
    var featured = POSTS.filter(function (p) {
      return p.featured;
    }).length;

    var facts =
      "<li><b>" +
      POSTS.length +
      "</b> 篇文章</li>" +
      "<li><b>" +
      featured +
      "</b> 篇精选</li>" +
      "<li><b>" +
      TAGS.length +
      "</b> 个标签</li>" +
      (POSTS.length ? "<li>更新于 <b>" + fmtShort(POSTS[0].date) + "</b></li>" : "");

    return (
      '<div class="wrap">' +
      '<section class="hero">' +
      '<p class="hero__kicker">' +
      esc(SITE.kicker || "") +
      "</p>" +
      '<h1 class="hero__title">' +
      esc(SITE.hero.before) +
      "<em>" +
      esc(SITE.hero.em) +
      "</em>" +
      esc(SITE.hero.after) +
      "</h1>" +
      '<p class="hero__lede">' +
      esc(SITE.lede || "") +
      "</p>" +
      '<ul class="hero__facts">' +
      facts +
      "</ul>" +
      '<span class="hero__corner">' +
      esc(SITE.latin || "") +
      "</span>" +
      "</section>" +
      '<div class="home-grid">' +
      '<section class="stack">' +
      '<div class="section-head"><h2>最近的文章<span>' +
      pad2(latest.length) +
      '</span></h2><a href="#/posts">全部文章 →</a></div>' +
      '<ol class="rows">' +
      latest
        .map(function (p, i) {
          return postRow(p, i);
        })
        .join("") +
      "</ol>" +
      "</section>" +
      '<aside class="rail">' +
      aboutCard() +
      tagsCard() +
      nowCard() +
      "</aside>" +
      "</div></div>"
    );
  }

  function tagChips() {
    var chips = TAGS.map(function (t) {
      return (
        '<button class="chip" type="button" data-tag="' +
        esc(t) +
        '">' +
        esc(t) +
        " " +
        tagCount(t) +
        "</button>"
      );
    }).join("");
    return '<button class="chip is-on" type="button" data-tag="">全部 ' + POSTS.length + "</button>" + chips;
  }

  function viewPosts() {
    return (
      '<div class="wrap">' +
      '<header class="page-head">' +
      '<p class="kicker">Index · ' +
      POSTS.length +
      " 篇</p>" +
      "<h1>全部文章</h1>" +
      '<p class="page-head__lede">按时间倒序排列。可以搜索标题、摘要与正文，也可以用标签筛选。</p>' +
      "</header>" +
      '<div class="filters">' +
      '<label class="field">' +
      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="9" r="5.5"></circle><path d="M13.2 13.2 17 17"></path></svg>' +
      '<input id="archiveSearch" type="search" placeholder="搜索文章…" autocomplete="off" aria-label="搜索文章">' +
      "</label>" +
      '<div class="chips" id="archiveTags">' +
      tagChips() +
      "</div></div>" +
      '<p class="kicker archive__count" id="archiveCount"></p>' +
      '<div class="archive" id="archiveList">' +
      archiveHtml(POSTS) +
      "</div>" +
      '<p class="empty" id="archiveEmpty" hidden>没有找到匹配的文章，换个关键词试试。</p>' +
      "</div>"
    );
  }

  function viewTags() {
    var blocks = TAGS.map(function (t) {
      var list = TAG_MAP[t]
        .map(function (p) {
          return (
            '<li><a href="#/post/' +
            encodeURIComponent(p.slug) +
            '">' +
            esc(p.title) +
            "<time>" +
            fmtShort(p.date) +
            "</time></a></li>"
          );
        })
        .join("");
      return (
        '<section class="tag-block">' +
        '<div class="tag-block__head"><h2>' +
        esc(t) +
        "</h2><span>" +
        TAG_MAP[t].length +
        " 篇</span></div>" +
        "<ul>" +
        list +
        "</ul></section>"
      );
    }).join("");

    return (
      '<div class="wrap">' +
      '<header class="page-head">' +
      '<p class="kicker">Tags · ' +
      TAGS.length +
      "</p><h1>标签</h1>" +
      '<p class="page-head__lede">文章按主题聚在一起。标签是我事后整理的，所以有时候一篇会挂在两个下面。</p>' +
      "</header>" +
      '<div class="archive tag-columns">' +
      blocks +
      "</div></div>"
    );
  }

  function viewTag(name) {
    var posts = TAG_MAP[name] || [];
    if (!posts.length) return viewNotFound("这个标签还没有文章");

    return (
      '<div class="wrap">' +
      '<header class="page-head">' +
      '<p class="kicker"><a href="#/tags">标签</a> · ' +
      posts.length +
      ' 篇</p><h1>#' +
      esc(name) +
      "</h1>" +
      '<p class="page-head__lede">标记为「' +
      esc(name) +
      "」的全部文章。</p>" +
      "</header>" +
      '<div class="archive">' +
      archiveHtml(posts) +
      "</div>" +
      '<p style="margin-top:36px"><a class="btn" href="#/posts">← 全部文章</a></p>' +
      "</div>"
    );
  }

  function viewPost(slug) {
    var index = -1;
    POSTS.forEach(function (p, i) {
      if (p.slug === slug) index = i;
    });
    if (index === -1) return viewNotFound("没有找到这篇文章");

    var p = POSTS[index];
    var newer = POSTS[index - 1];
    var older = POSTS[index + 1];

    var pager =
      '<nav class="pager" aria-label="上下篇">' +
      (newer
        ? '<a href="#/post/' +
          encodeURIComponent(newer.slug) +
          '"><span>← 更新</span><strong>' +
          esc(newer.title) +
          "</strong></a>"
        : '<a class="is-empty" href="#/posts" tabindex="-1"><span>← 更新</span><strong>已经是最新一篇</strong></a>') +
      (older
        ? '<a class="is-next" href="#/post/' +
          encodeURIComponent(older.slug) +
          '"><span>更早 →</span><strong>' +
          esc(older.title) +
          "</strong></a>"
        : '<a class="is-empty is-next" href="#/posts" tabindex="-1"><span>更早 →</span><strong>已经是最早一篇</strong></a>') +
      "</nav>";

    return (
      '<div class="wrap"><article class="post">' +
      '<div class="post-grid"><div>' +
      '<header class="post__head">' +
      '<div class="post__kicker kicker"><a href="#/posts">文章</a><span>/</span><time datetime="' +
      p.date +
      '">' +
      fmtDate(p.date) +
      "</time></div>" +
      '<h1 class="post__title">' +
      esc(p.title) +
      "</h1>" +
      (p.summary ? '<p class="post__summary">' + esc(p.summary) + "</p>" : "") +
      '<div class="post__meta">' +
      "<span>" +
      p.minutes +
      " 分钟阅读</span>" +
      '<span class="dot">·</span><span>约 ' +
      p.words +
      " 字</span>" +
      '<span class="dot">·</span><span class="row__tags">' +
      p.tags.map(tagLink).join("") +
      "</span></div>" +
      "</header>" +
      '<div class="prose">' +
      p.html +
      "</div>" +
      '<footer class="post__foot">' +
      '<p class="post__foot-label">标签</p>' +
      '<div class="tags-cloud">' +
      p.tags.map(tagLink).join("") +
      "</div>" +
      '<div class="post__actions">' +
      '<button class="btn" type="button" data-copy-link>复制本文链接</button>' +
      '<a class="btn" href="#/posts">返回列表</a>' +
      "</div>" +
      pager +
      "</footer>" +
      "</div>" +
      '<aside class="toc" id="toc" aria-label="目录"></aside>' +
      "</div></article></div>"
    );
  }

  function viewAbout() {
    var intro = (SITE.intro || [])
      .map(function (t) {
        return "<p>" + esc(t) + "</p>";
      })
      .join("");

    var timeline = (SITE.timeline || [])
      .map(function (item) {
        return (
          '<li><time>' +
          esc(item.year) +
          "</time><div><strong>" +
          esc(item.title) +
          "</strong><p>" +
          esc(item.text) +
          "</p></div></li>"
        );
      })
      .join("");

    var stack = (SITE.stack || [])
      .map(function (s) {
        return "<li>" + esc(s) + "</li>";
      })
      .join("");

    var links = (SITE.links || [])
      .map(function (l) {
        return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + "</a></li>";
      })
      .join("");

    return (
      '<div class="wrap">' +
      '<header class="page-head">' +
      '<p class="kicker">About</p><h1>关于我</h1>' +
      '<p class="page-head__lede">一个普通写代码的人，和一个不太勤快的博客。</p>' +
      "</header>" +
      '<div class="about-grid">' +
      '<div class="prose">' +
      intro +
      "<h2>现在在做的事</h2>" +
      '<ul class="now-list">' +
      (SITE.now || [])
        .map(function (i) {
          return "<li>" + esc(i.text) + "</li>";
        })
        .join("") +
      "</ul>" +
      "<h2>一些年表</h2>" +
      '<ol class="timeline">' +
      timeline +
      "</ol>" +
      "<h2>关于这个站点</h2>" +
      "<p>这个站点是手写的：没有构建步骤，没有框架，没有数据库。文章是 Markdown，放在一个 <code>script</code> 标签里，浏览器打开 <code>index.html</code> 就能读。之所以这么做，是因为我曾经花了太多时间折腾博客本身，而不是写文章。</p>" +
      "<blockquote>工具越简单，写作越容易发生。</blockquote>" +
      "<p>如果你也想有一个这样的地方，直接拿走即可——它没有秘密，也没有依赖。</p>" +
      "</div>" +
      '<aside class="rail">' +
      '<div class="card"><p class="card__label">联系</p><ul class="now-list">' +
      links +
      "</ul></div>" +
      '<div class="card"><p class="card__label">常用</p><ul class="stack-list">' +
      stack +
      "</ul></div>" +
      "</aside></div></div>"
    );
  }

  function viewNotFound(message) {
    return (
      '<div class="wrap">' +
      '<header class="page-head">' +
      '<p class="kicker">404</p><h1>这里什么都没有</h1>' +
      '<p class="page-head__lede">' +
      esc(message || "你访问的页面不存在，或者已经被我删掉了。") +
      "</p></header>" +
      '<p style="margin-top:32px"><a class="btn" href="#/">回到首页</a> <a class="btn" href="#/posts">全部文章</a></p>' +
      "</div>"
    );
  }

  /* ------------------------------------------------------- 目录与阅读进度 */
  function buildToc() {
    var prose = $(".prose");
    var toc = $("#toc");
    if (!prose || !toc) return;

    var heads = $$("h2, h3", prose).filter(function (h) {
      return !h.closest("blockquote");
    });

    if (!heads.length) {
      toc.hidden = true;
      state.spy = null;
      return;
    }

    var html = "";
    var links = [];

    heads.forEach(function (h, i) {
      var label = h.textContent;
      var id = "sec-" + i + "-" + slugify(label);
      h.id = id;

      var anchor = document.createElement("a");
      anchor.className = "block-anchor";
      anchor.setAttribute("data-scroll", id);
      anchor.setAttribute("aria-hidden", "true");
      anchor.textContent = "§";
      h.appendChild(anchor);

      var depth = h.tagName === "H2" ? 2 : 3;
      html +=
        '<li class="d' +
        depth +
        '"><a href="#' +
        id +
        '" data-scroll="' +
        id +
        '">' +
        esc(label) +
        "</a></li>";
      links.push({ el: h, link: null });
    });

    toc.innerHTML = '<p class="toc__label">目录</p><ol>' + html + "</ol>";

    /* 窄屏用可折叠的目录代替右侧栏 */
    var mobileToc = document.createElement("details");
    mobileToc.className = "toc-mobile";
    mobileToc.innerHTML =
      "<summary>目录 <span>" + heads.length + " 节</span></summary><ol>" + html + "</ol>";
    prose.parentNode.insertBefore(mobileToc, prose);

    var anchors = $$("#toc a");
    links.forEach(function (item, i) {
      item.link = anchors[i];
    });

    state.spy = { items: links, active: null };
    updateSpy();
  }

  function updateSpy() {
    var spy = state.spy;
    if (!spy) return;

    var offset = 120;
    var active = -1;
    spy.items.forEach(function (item, i) {
      var top = item.el.getBoundingClientRect().top;
      if (top - offset <= 0) active = i;
    });

    if (active === spy.active) return;
    spy.active = active;
    spy.items.forEach(function (item, i) {
      if (!item.link) return;
      if (i === active) item.link.classList.add("is-active");
      else item.link.classList.remove("is-active");
    });
  }

  function updateProgress() {
    if (!progressBar) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.width = (ratio * 100).toFixed(2) + "%";
    progressBar.hidden = state.route.name !== "post";
  }

  function onScroll() {
    if (header) header.classList.toggle("is-stuck", window.scrollY > 6);
    if (toTopBtn) toTopBtn.classList.toggle("is-on", window.scrollY > 640);
    if (state.route.name === "post") {
      updateProgress();
      updateSpy();
    }
  }

  /* --------------------------------------------------------- 归档筛选 */
  function bindArchive() {
    var input = $("#archiveSearch");
    var list = $("#archiveList");
    var empty = $("#archiveEmpty");
    var count = $("#archiveCount");
    var chips = $$("#archiveTags .chip");
    if (!input || !list) return;

    function apply() {
      var q = state.query.trim().toLowerCase();
      var tag = state.tag;

      var filtered = POSTS.filter(function (p) {
        if (tag && p.tags.indexOf(tag) === -1) return false;
        if (!q) return true;
        var haystack = (p.title + " " + p.summary + " " + p.tags.join(" ") + " " + p.plain).toLowerCase();
        return haystack.indexOf(q) !== -1;
      });

      list.innerHTML = archiveHtml(filtered);
      if (empty) empty.hidden = filtered.length > 0;
      if (count) count.textContent = "显示 " + filtered.length + " / " + POSTS.length + " 篇";
      chips.forEach(function (c) {
        var on = (c.getAttribute("data-tag") || "") === tag;
        c.classList.toggle("is-on", on);
        c.setAttribute("aria-pressed", String(on));
      });
    }

    input.value = state.query;
    input.addEventListener("input", function () {
      state.query = input.value;
      apply();
    });

    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        state.tag = c.getAttribute("data-tag") || "";
        apply();
      });
    });

    apply();
  }

  /* --------------------------------------------------------- 剪贴板 */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      /* 忽略：旧浏览器不支持时静默 */
    }
    document.body.removeChild(ta);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(function () {
        legacyCopy(text);
      });
    } else {
      legacyCopy(text);
    }
  }

  function flash(btn, text) {
    var original = btn.textContent;
    btn.textContent = text;
    btn.classList.add("is-done");
    window.setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("is-done");
    }, 1600);
  }

  /* --------------------------------------------------------- 主题 */
  function initTheme() {
    var btn = $("#themeToggle");
    if (!btn) return;

    function sync() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      btn.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
      btn.setAttribute("aria-pressed", String(dark));
    }

    btn.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
      try {
        localStorage.setItem("zw-theme", dark ? "light" : "dark");
      } catch (err) {
        /* localStorage 不可用时仅本次生效 */
      }
      sync();
    });

    sync();
  }

  /* --------------------------------------------------------- 搜索面板 */
  function initPalette() {
    var palette = $("#palette");
    var input = $("#paletteInput");
    var list = $("#paletteResults");
    var hint = $("#paletteHint");
    if (!palette || !input || !list) return;

    var items = [];
    var active = 0;

    function mark(text, q) {
      if (!q) return esc(text);
      var i = text.toLowerCase().indexOf(q);
      if (i === -1) return esc(text);
      return (
        esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length))
      );
    }

    function run(query) {
      var q = query.trim().toLowerCase();
      items = POSTS.filter(function (p) {
        if (!q) return true;
        return (p.title + " " + p.summary + " " + p.tags.join(" ") + " " + p.plain).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 7);

      active = 0;

      if (!items.length) {
        list.innerHTML = '<li class="palette__empty">没有匹配的文章</li>';
        return;
      }

      list.innerHTML = items
        .map(function (p, i) {
          return (
            '<li aria-selected="' +
            (i === 0 ? "true" : "false") +
            '"><a href="#/post/' +
            encodeURIComponent(p.slug) +
            '" data-index="' +
            i +
            '">' +
            '<span class="r-num">' +
            pad2(i + 1) +
            "</span>" +
            "<span>" +
            '<span class="r-title">' +
            mark(p.title, q) +
            "</span>" +
            '<span class="r-meta">' +
            fmtShort(p.date) +
            " · " +
            p.minutes +
            " 分钟 · " +
            esc(p.tags.join(" / ")) +
            "</span>" +
            "</span></a></li>"
          );
        })
        .join("");
    }

    function setActive(index) {
      var nodes = $$("li", list).filter(function (li) {
        return li.hasAttribute("aria-selected");
      });
      if (!nodes.length) return;
      active = (index + nodes.length) % nodes.length;
      nodes.forEach(function (li, i) {
        li.setAttribute("aria-selected", i === active ? "true" : "false");
      });
      var current = nodes[active];
      if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
    }

    function open() {
      palette.hidden = false;
      document.documentElement.classList.add("is-locked");
      input.value = "";
      run("");
      input.focus();
    }

    function close() {
      palette.hidden = true;
      document.documentElement.classList.remove("is-locked");
    }

    function go(index) {
      var p = items[index];
      if (!p) return;
      close();
      location.hash = "#/post/" + encodeURIComponent(p.slug);
    }

    var searchBtn = $("#searchOpen");
    var searchBtnMobile = $("#searchOpenMobile");
    var menuPanel = $("#mobilePanel");

    function collapseMenu() {
      if (menuPanel && !menuPanel.hidden) {
        menuPanel.classList.remove("is-open");
        menuPanel.hidden = true;
        var toggle = $("#menuToggle");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    }

    if (searchBtn) searchBtn.addEventListener("click", open);
    if (searchBtnMobile) {
      searchBtnMobile.addEventListener("click", function () {
        collapseMenu();
        open();
      });
    }

    palette.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) close();
      var link = e.target.closest("a[data-index]");
      if (link) {
        e.preventDefault();
        go(Number(link.getAttribute("data-index")));
      }
    });

    input.addEventListener("input", function () {
      run(input.value);
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(active + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(active - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        go(active);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    if (hint) hint.textContent = "↑ ↓ 选择 · ↵ 打开 · Esc 关闭";

    document.addEventListener("keydown", function (e) {
      var isEditable = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      var meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (palette.hidden) open();
        else close();
        return;
      }

      if (e.key === "/" && !isEditable && !meta) {
        e.preventDefault();
        open();
        return;
      }

      if (e.key === "Escape" && !palette.hidden) {
        e.preventDefault();
        close();
      }
    });
  }

  /* --------------------------------------------------------- 移动菜单 */
  function initMenu() {
    var btn = $("#menuToggle");
    var panel = $("#mobilePanel");
    if (!btn || !panel) return;

    function setOpen(open) {
      panel.hidden = !open;
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }

    btn.addEventListener("click", function () {
      setOpen(panel.hidden);
    });

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    window.addEventListener("hashchange", function () {
      if (!panel.hidden) setOpen(false);
    });
  }

  /* --------------------------------------------------------- 全局委托 */
  function initDelegates() {
    document.addEventListener("click", function (e) {
      var copyBtn = e.target.closest(".code__copy");
      if (copyBtn) {
        var block = copyBtn.closest(".code");
        var pre = block ? block.querySelector("pre") : null;
        if (pre) {
          copyText(pre.innerText);
          flash(copyBtn, "已复制");
        }
        return;
      }

      var scroller = e.target.closest("[data-scroll]");
      if (scroller) {
        e.preventDefault();
        var target = document.getElementById(scroller.getAttribute("data-scroll"));
        var details = scroller.closest("details");
        if (details) details.open = false;
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          try {
            history.replaceState(null, "", location.hash);
          } catch (err) {
            /* file:// 下个别浏览器不允许改写历史，忽略即可 */
          }
        }
        return;
      }

      var linkBtn = e.target.closest("[data-copy-link]");
      if (linkBtn) {
        copyText(location.href);
        flash(linkBtn, "已复制");
        return;
      }
    });

    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("resize", function () {
      if (state.route.name === "post") updateProgress();
    });

    if (toTopBtn) {
      toTopBtn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* --------------------------------------------------------- 路由 */
  function parseRoute() {
    var raw = (location.hash || "").replace(/^#/, "");
    var path;
    try {
      path = decodeURIComponent(raw || "/");
    } catch (err) {
      path = raw || "/";
    }
    var parts = path.split("/").filter(Boolean);

    if (!parts.length) return { name: "home" };
    if (parts[0] === "post" && parts[1]) return { name: "post", slug: parts[1] };
    if (parts[0] === "tag" && parts[1]) return { name: "tag", tag: parts[1] };
    if (parts.length === 1 && ["posts", "tags", "about"].indexOf(parts[0]) !== -1) {
      return { name: parts[0] };
    }
    return { name: "notfound" };
  }

  function setMeta(route, post) {
    var title =
      route.name === "post" && post
        ? post.title + " · " + SITE.name
        : route.name === "posts"
        ? "全部文章 · " + SITE.name
        : route.name === "tags"
        ? "标签 · " + SITE.name
        : route.name === "tag"
        ? "#" + route.tag + " · " + SITE.name
        : route.name === "about"
        ? "关于 · " + SITE.name
        : SITE.name + " · " + (SITE.kicker || "");

    document.title = title;

    var desc = post && post.summary ? post.summary : SITE.lede || "";
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && desc) metaDesc.setAttribute("content", desc);
  }

  function render(options) {
    var route = parseRoute();
    var previous = state.route;
    state.route = route;

    var html = "";
    switch (route.name) {
      case "home":
        html = viewHome();
        break;
      case "posts":
        html = viewPosts();
        break;
      case "tags":
        html = viewTags();
        break;
      case "tag":
        html = viewTag(route.tag);
        break;
      case "post":
        html = viewPost(route.slug);
        break;
      case "about":
        html = viewAbout();
        break;
      default:
        html = viewNotFound();
    }

    main.innerHTML = html;
    main.classList.remove("view-in");
    /* 强制重排，让入场动画每次都重新播放 */
    void main.offsetWidth;
    main.classList.add("view-in");

    navBind();

    var currentPost = null;
    if (route.name === "post") {
      POSTS.forEach(function (p) {
        if (p.slug === route.slug) currentPost = p;
      });
    }
    setMeta(route, currentPost);

    state.spy = null;
    if (route.name === "post") {
      buildToc();
    }

    if (route.name === "posts") bindArchive();
    if (route.name === "tag") {
      state.tag = route.tag;
    }

    if (progressBar) progressBar.hidden = route.name !== "post";

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    onScroll();

    if (options && options.focus) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }

    /* 记录路由变化，供 onScroll 判断 */
    state.previous = previous;
  }

  /* --------------------------------------------------------- 页头页脚 */
  /* 身份信息只在 site.js 里写一次，这里把它铺到静态标记上 */
  function hydrateChrome() {
    var name = SITE.name || "";
    var year = new Date().getFullYear();

    $$("[data-site-name]").forEach(function (el) {
      el.textContent = name;
    });
    $$("[data-site-latin]").forEach(function (el) {
      el.textContent = SITE.latin || "";
    });
    $$("[data-site-note]").forEach(function (el) {
      if (SITE.footerNote) el.textContent = SITE.footerNote;
    });
    $$("[data-copyright]").forEach(function (el) {
      el.textContent = "© " + year + (SITE.author ? " " + SITE.author : "");
    });
    $$("[data-build-note]").forEach(function (el) {
      if (SITE.buildNote) el.textContent = SITE.buildNote;
    });

    var brand = $(".brand");
    if (brand) brand.setAttribute("aria-label", name + " · 回到首页");

    var feed = document.querySelector('link[rel="alternate"][type="application/rss+xml"]');
    if (feed) feed.setAttribute("title", name + " · RSS");

    var canonical = document.querySelector("link[data-canonical]");
    if (canonical && SITE.url) canonical.setAttribute("href", SITE.url);

    var contact = $("[data-contact-links]");
    if (contact) {
      var items = (SITE.links || []).map(function (link) {
        var external = /^https?:/i.test(link.href);
        return (
          '<li><a href="' +
          esc(link.href) +
          '"' +
          (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
          ">" +
          esc(link.label) +
          "</a></li>"
        );
      });
      items.push('<li><a href="feed.xml">RSS</a></li>');
      contact.innerHTML = items.join("");
    }
  }

  /* --------------------------------------------------------- 启动 */
  function syncKbd() {
    var isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
    if (isMac) return;
    var btnKbd = $(".search-btn kbd");
    if (btnKbd) btnKbd.textContent = "Ctrl K";
    var hintKbd = $(".palette__hint .kbd");
    if (hintKbd) hintKbd.textContent = "Ctrl K";
  }

  function boot() {
    syncKbd();
    hydrateChrome();
    initTheme();
    initPalette();
    initMenu();
    initDelegates();

    window.addEventListener("hashchange", function () {
      render({ focus: true });
    });

    if (!location.hash) {
      /* 用 replaceState 保持地址干净；个别环境不允许改写，忽略 */
      try {
        history.replaceState(null, "", "#/");
      } catch (err) {
        /* noop */
      }
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
