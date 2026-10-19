/* =========================================================================
   Markdown 渲染器 · 无依赖，约 330 行
   -------------------------------------------------------------------------
   支持：标题、段落、粗体/斜体/删除线、行内代码、围栏代码块（带高亮）、
        引用、有序/无序列表（可嵌套）、任务列表、表格、分隔线、链接、图片。
   入口：window.MD.render(markdown) / MD.inline(text) / MD.plain(markdown)
   ========================================================================= */
(function (global) {
  "use strict";

  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return ESC[ch];
    });
  }

  function span(cls, text) {
    return '<span class="' + cls + '">' + escapeHtml(text) + "</span>";
  }

  /* --------------------------------------------------------------- 高亮 */
  var WORDS = {
    js: "const let var function return if else for while do switch case break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of delete void yield static get set null undefined true false with debugger",
    ts: "interface type enum implements readonly public private protected declare namespace abstract as is keyof infer satisfies never unknown any string number boolean object symbol bigint module require constructor override asserts",
    json: "true false null",
    bash: "if then else elif fi for in do done case esac while until function return local export readonly echo cd ls cat grep sed awk curl mkdir rm cp mv git npm pnpm node python brew sudo exit set source",
    sh: "if then else elif fi for in do done case esac while until function return local export readonly echo cd ls cat grep sed awk curl mkdir rm cp mv git npm pnpm node python sudo exit set source",
    sql: "select from where insert into values update set delete create table index view trigger if not exists primary key foreign references on join left right inner outer group by order asc desc limit offset as and or is null default unique constraint begin commit rollback transaction vacuum pragma with returning drop alter add column cascade autoincrement integer text real blob",
    py: "def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield global nonlocal pass break continue del assert async await self print",
    go: "package import func var const type struct interface map chan go defer select range if else for return switch case break continue nil true false make new len cap append string int bool error",
    rust: "fn let mut pub struct enum impl trait for while loop if else match return use mod crate self super where async await move ref dyn box Self Some None Ok Err true false",
    java: "public private protected class interface extends implements new return if else for while do switch case break continue static final void int long double float boolean char String null true false try catch finally throw throws import package this super abstract synchronized",
    css: "",
    html: ""
  };

  var CFG = {
    js: { line: "//", block: ["/*", "*/"], strings: ["'", '"', "`"], keywords: set(WORDS.js) },
    jsx: { line: "//", block: ["/*", "*/"], strings: ["'", '"', "`"], keywords: set(WORDS.js) },
    mjs: { line: "//", block: ["/*", "*/"], strings: ["'", '"', "`"], keywords: set(WORDS.js) },
    ts: { line: "//", block: ["/*", "*/"], strings: ["'", '"', "`"], keywords: set(WORDS.js + " " + WORDS.ts) },
    tsx: { line: "//", block: ["/*", "*/"], strings: ["'", '"', "`"], keywords: set(WORDS.js + " " + WORDS.ts) },
    json: { line: null, block: null, strings: ['"'], keywords: set(WORDS.json) },
    bash: { line: "#", block: null, strings: ["'", '"'], keywords: set(WORDS.bash) },
    sh: { line: "#", block: null, strings: ["'", '"'], keywords: set(WORDS.sh) },
    shell: { line: "#", block: null, strings: ["'", '"'], keywords: set(WORDS.bash) },
    sql: { line: "--", block: ["/*", "*/"], strings: ["'"], keywords: set(WORDS.sql) },
    py: { line: "#", block: null, strings: ["'", '"'], keywords: set(WORDS.py) },
    python: { line: "#", block: null, strings: ["'", '"'], keywords: set(WORDS.py) },
    go: { line: "//", block: ["/*", "*/"], strings: ['"', "`"], keywords: set(WORDS.go) },
    rust: { line: "//", block: ["/*", "*/"], strings: ['"'], keywords: set(WORDS.rust) },
    java: { line: "//", block: ["/*", "*/"], strings: ['"', "'"], keywords: set(WORDS.java) }
  };

  function set(names) {
    var s = Object.create(null);
    names.split(/\s+/).forEach(function (w) {
      if (w) s[w] = true;
    });
    return s;
  }

  var WORD_RE = /[A-Za-z0-9_$]/;

  function hlGeneric(code, cfg) {
    var out = "";
    var i = 0;
    var n = code.length;

    while (i < n) {
      var ch = code[i];

      /* 块注释 */
      if (cfg.block && code.substr(i, cfg.block[0].length) === cfg.block[0]) {
        var bcEnd = code.indexOf(cfg.block[1], i + cfg.block[0].length);
        var bcStop = bcEnd === -1 ? n : bcEnd + cfg.block[1].length;
        out += span("t-cm", code.slice(i, bcStop));
        i = bcStop;
        continue;
      }

      /* 行注释 */
      if (cfg.line && code.substr(i, cfg.line.length) === cfg.line) {
        var lcEnd = code.indexOf("\n", i);
        if (lcEnd === -1) lcEnd = n;
        out += span("t-cm", code.slice(i, lcEnd));
        i = lcEnd;
        continue;
      }

      /* 字符串 */
      if (cfg.strings.indexOf(ch) !== -1) {
        var j = i + 1;
        while (j < n) {
          if (code[j] === "\\") {
            j += 2;
            continue;
          }
          if (code[j] === ch) {
            j += 1;
            break;
          }
          if (code[j] === "\n" && ch !== "`") break;
          j += 1;
        }
        out += span("t-str", code.slice(i, j));
        i = j;
        continue;
      }

      /* 数字 */
      if (ch >= "0" && ch <= "9" && !WORD_RE.test(code[i - 1] || "")) {
        var k = i;
        while (k < n && /[0-9a-fA-FxX._]/.test(code[k])) k += 1;
        out += span("t-num", code.slice(i, k));
        i = k;
        continue;
      }

      /* 标识符 / 关键字 / 函数名 */
      if (WORD_RE.test(ch)) {
        var w = i;
        while (w < n && WORD_RE.test(code[w])) w += 1;
        var word = code.slice(i, w);
        if (cfg.keywords[word]) out += span("t-kw", word);
        else if (code[w] === "(" && !/^(if|for|while|switch|catch|return)$/.test(word))
          out += span("t-fn", word);
        else out += escapeHtml(word);
        i = w;
        continue;
      }

      out += escapeHtml(ch);
      i += 1;
    }

    return out;
  }

  function hlCss(code) {
    var out = "";
    var i = 0;
    var n = code.length;

    while (i < n) {
      var ch = code[i];

      if (code.substr(i, 2) === "/*") {
        var cEnd = code.indexOf("*/", i + 2);
        var cStop = cEnd === -1 ? n : cEnd + 2;
        out += span("t-cm", code.slice(i, cStop));
        i = cStop;
        continue;
      }

      if (ch === '"' || ch === "'") {
        var sEnd = i + 1;
        while (sEnd < n && code[sEnd] !== ch) {
          if (code[sEnd] === "\\") sEnd += 1;
          sEnd += 1;
        }
        out += span("t-str", code.slice(i, sEnd + 1));
        i = sEnd + 1;
        continue;
      }

      if (ch === "@") {
        var atM = /^@[\w-]+/.exec(code.slice(i));
        if (atM) {
          out += span("t-kw", atM[0]);
          i += atM[0].length;
          continue;
        }
      }

      if (ch === "#" && /[0-9a-fA-F]/.test(code[i + 1] || "")) {
        var hexM = /^#[0-9a-fA-F]{3,8}/.exec(code.slice(i));
        if (hexM) {
          out += span("t-num", hexM[0]);
          i += hexM[0].length;
          continue;
        }
      }

      if (ch === "." || ch === "#" || ch === ":" || ch === "&") {
        var selM = /^[.#:&][\w-]+/.exec(code.slice(i));
        if (selM) {
          out += span("t-sel", selM[0]);
          i += selM[0].length;
          continue;
        }
      }

      if (ch >= "0" && ch <= "9") {
        var numM = /^[0-9.]+(?:%|[a-z]{1,4})?/.exec(code.slice(i));
        out += span("t-num", numM[0]);
        i += numM[0].length;
        continue;
      }

      if (/[a-zA-Z-]/.test(ch)) {
        var wordM = /^[a-zA-Z-][\w-]*/.exec(code.slice(i));
        var rest = code.slice(i + wordM[0].length);
        if (/^\s*:/.test(rest) && !/^\s*::/.test(rest)) out += span("t-prop", wordM[0]);
        else out += escapeHtml(wordM[0]);
        i += wordM[0].length;
        continue;
      }

      out += escapeHtml(ch);
      i += 1;
    }

    return out;
  }

  function hlHtml(code) {
    var out = "";
    var i = 0;
    var n = code.length;

    while (i < n) {
      var ch = code[i];

      if (code.substr(i, 4) === "&lt;") {
        out += code.substr(i, 4);
        i += 4;
        continue;
      }

      if (ch === "<") {
        var tagM = /^<\/?[A-Za-z][\w:.-]*/.exec(code.slice(i));
        if (tagM) {
          out += span("t-tag", tagM[0]);
          i += tagM[0].length;
          continue;
        }
        if (code.substr(i, 9) === "<!DOCTYPE" || code.substr(i, 9) === "<!doctype") {
          var dtEnd = code.indexOf(">", i);
          var dtStop = dtEnd === -1 ? n : dtEnd + 1;
          out += span("t-cm", code.slice(i, dtStop));
          i = dtStop;
          continue;
        }
        out += escapeHtml(ch);
        i += 1;
        continue;
      }

      if (ch === '"' || ch === "'") {
        var vEnd = i + 1;
        while (vEnd < n && code[vEnd] !== ch) vEnd += 1;
        out += span("t-str", code.slice(i, vEnd + 1));
        i = vEnd + 1;
        continue;
      }

      if (/[A-Za-z_:@-]/.test(ch)) {
        var aM = /^[A-Za-z_:@-][\w:.-]*/.exec(code.slice(i));
        var after = code.slice(i + aM[0].length);
        if (/^\s*=/.test(after)) out += span("t-prop", aM[0]);
        else out += escapeHtml(aM[0]);
        i += aM[0].length;
        continue;
      }

      out += escapeHtml(ch);
      i += 1;
    }

    return out;
  }

  function highlight(code, lang) {
    var l = String(lang || "").toLowerCase();
    if (l === "css" || l === "scss" || l === "less" || l === "postcss") return hlCss(code);
    if (l === "html" || l === "xml" || l === "svg" || l === "vue" || l === "htm") return hlHtml(code);
    if (l === "md" || l === "markdown" || l === "text" || l === "txt" || l === "") return escapeHtml(code);
    if (CFG[l]) return hlGeneric(code, CFG[l]);
    return escapeHtml(code);
  }

  /* ------------------------------------------------------------- 行内 */
  function inline(text) {
    var store = [];
    function keep(html) {
      store.push(html);
      return "\u0000" + (store.length - 1) + "\u0000";
    }

    var s = escapeHtml(text);

    /* 行内代码：先抽出来，避免内部被当作强调语法 */
    s = s.replace(/`([^`\n]+)`/g, function (_, code) {
      return keep("<code>" + code + "</code>");
    });

    /* 图片 */
    s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g, function (_, alt, src, title) {
      var t = title ? ' title="' + title + '"' : "";
      return keep(
        '<img src="' +
          src +
          '" alt="' +
          alt +
          '"' +
          t +
          ' loading="lazy" decoding="async">'
      );
    });

    /* 链接 */
    s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g, function (_, label, href, title) {
      var external = /^https?:\/\//i.test(href);
      var attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      var t = title ? ' title="' + title + '"' : "";
      return keep('<a href="' + href + '"' + t + attrs + ">" + emphasis(label) + "</a>");
    });

    s = emphasis(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (_, idx) {
      return store[Number(idx)];
    });
  }

  function emphasis(s) {
    return s
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  }

  /* ------------------------------------------------------------- 块级 */
  function indentOf(line) {
    var m = /^[ ]*/.exec(line);
    return m ? m[0].length : 0;
  }

  var BLOCK_START = /^[ ]*(```|~~~|#{1,6}\s|>|([-*+]|\d+[.)])\s)/;

  function isBlockStart(line) {
    if (BLOCK_START.test(line)) return true;
    if (/^[ ]*([-*_])([ ]*\1){2,}[ ]*$/.test(line)) return true;
    return false;
  }

  function codeBlock(code, lang) {
    var safe = String(lang || "").replace(/[^\w+#.-]/g, "");
    var label = safe ? safe.toUpperCase() : "TEXT";
    return (
      '<div class="code"><div class="code__bar"><span class="code__lang">' +
      escapeHtml(label) +
      '</span><button class="code__copy" type="button">复制</button></div>' +
      "<pre><code>" +
      highlight(code, safe) +
      "</code></pre></div>"
    );
  }

  function renderBlocks(lines) {
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) {
        i += 1;
        continue;
      }

      /* 围栏代码 */
      var fence = /^[ ]*(```|~~~)\s*([^\s`]*)\s*$/.exec(line);
      if (fence) {
        var marker = fence[1];
        var lang = fence[2] || "";
        var buf = [];
        i += 1;
        while (i < lines.length) {
          if (new RegExp("^[ ]*" + marker + "[ ]*$").test(lines[i])) {
            i += 1;
            break;
          }
          buf.push(lines[i]);
          i += 1;
        }
        out.push(codeBlock(buf.join("\n"), lang));
        continue;
      }

      /* 标题 */
      var heading = /^[ ]{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        var level = heading[1].length;
        out.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
        i += 1;
        continue;
      }

      /* 分隔线 */
      if (/^[ ]*([-*_])([ ]*\1){2,}[ ]*$/.test(line)) {
        out.push("<hr>");
        i += 1;
        continue;
      }

      /* 引用 */
      if (/^[ ]*>/.test(line)) {
        var quote = [];
        while (i < lines.length && /^[ ]*>/.test(lines[i])) {
          quote.push(lines[i].replace(/^[ ]*>[ ]?/, ""));
          i += 1;
        }
        out.push("<blockquote>" + renderBlocks(quote) + "</blockquote>");
        continue;
      }

      /* 表格 */
      if (line.indexOf("|") !== -1 && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        var table = renderTable(lines, i);
        out.push(table.html);
        i = table.next;
        continue;
      }

      /* 列表 */
      if (/^[ ]*([-*+]|\d+[.)])\s+/.test(line)) {
        var list = renderList(lines, i);
        out.push(list.html);
        i = list.next;
        continue;
      }

      /* 段落 */
      var para = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i += 1;
      }
      out.push("<p>" + inline(para.join("\n")).replace(/\n/g, "<br>") + "</p>");
    }

    return out.join("\n");
  }

  function isTableDivider(line) {
    if (!line || line.indexOf("-") === -1) return false;
    return /^[ ]*\|?[\s:|-]+\|[\s:|-]*$/.test(line);
  }

  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === "|") s = s.slice(1);
    if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
    return s.split("|").map(function (c) {
      return c.trim();
    });
  }

  function renderTable(lines, start) {
    var head = splitRow(lines[start]);
    var aligns = splitRow(lines[start + 1]).map(function (c) {
      if (/^:-+:$/.test(c)) return "center";
      if (/^-+:$/.test(c)) return "right";
      if (/^:-+$/.test(c)) return "left";
      return "";
    });
    var rows = [];
    var i = start + 2;
    while (i < lines.length && lines[i].trim() && lines[i].indexOf("|") !== -1) {
      rows.push(splitRow(lines[i]));
      i += 1;
    }

    function cell(tag, text, idx) {
      var align = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "";
      return "<" + tag + align + ">" + inline(text) + "</" + tag + ">";
    }

    var html = "<table><thead><tr>";
    head.forEach(function (c, idx) {
      html += cell("th", c, idx);
    });
    html += "</tr></thead><tbody>";
    rows.forEach(function (cells) {
      html += "<tr>";
      head.forEach(function (_, idx) {
        html += cell("td", cells[idx] || "", idx);
      });
      html += "</tr>";
    });
    html += "</tbody></table>";

    return { html: html, next: i };
  }

  function renderList(lines, start) {
    var baseIndent = indentOf(lines[start]);
    var first = /^[ ]*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[start]);
    var ordered = /^\d/.test(first[1]);
    var markerLen = first[1].length + 1;
    var contentIndent = baseIndent + markerLen;

    var block = [];
    var i = start;

    while (i < lines.length) {
      var line = lines[i];

      if (!line.trim()) {
        var j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        var resume =
          j < lines.length &&
          indentOf(lines[j]) >= contentIndent &&
          !/^[ ]*(#{1,6}\s|>)/.test(lines[j]);
        if (resume) {
          block.push("");
          i += 1;
          continue;
        }
        break;
      }

      if (indentOf(line) < baseIndent) break;
      if (
        indentOf(line) === baseIndent &&
        !/^[ ]*([-*+]|\d+[.)])\s+/.test(line) &&
        block.length
      )
        break;

      block.push(line);
      i += 1;
    }

    var items = [];
    var current = null;
    var itemRe = new RegExp("^[ ]{" + baseIndent + "}([-*+]|\\d+[.)])\\s+(.*)$");

    block.forEach(function (line) {
      var m = itemRe.exec(line);
      if (m) {
        current = [m[2]];
        items.push(current);
      } else if (current) {
        current.push(line.slice(Math.min(indentOf(line), contentIndent)));
      }
    });

    var tag = ordered ? "ol" : "ul";
    var html = items
      .map(function (arr) {
        var firstLine = arr[0];
        var box = "";
        if (/^\[[ xX]\]\s+/.test(firstLine)) {
          box = /^\[[xX]\]/.test(firstLine) ? "☑ " : "☐ ";
          arr[0] = firstLine.replace(/^\[[ xX]\]\s+/, "");
        }
        return "<li>" + box + renderBlocks(arr) + "</li>";
      })
      .join("");

    return { html: "<" + tag + ">" + html + "</" + tag + ">", next: i };
  }

  function render(markdown) {
    var text = String(markdown || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "  ");
    return renderBlocks(text.split("\n"));
  }

  /* 供搜索使用的纯文本 */
  function plain(markdown) {
    return String(markdown || "")
      .replace(/^[ ]*(```|~~~)[\s\S]*?^[ ]*\1[ ]*$/gm, " ")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/^[ ]{0,3}#{1,6}\s+/gm, " ")
      .replace(/[*_~>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  global.MD = {
    render: render,
    inline: inline,
    plain: plain,
    highlight: highlight,
    escapeHtml: escapeHtml
  };
})(window);
