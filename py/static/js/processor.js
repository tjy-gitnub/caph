class ContentProcessor {
  constructor() {
    // 初始化 marked
    marked.setOptions({
      breaks: true, // 正确展示换行
      highlight: function (code, lang) {
        return code;
      },
    });

    // 设置 marked 的自定义渲染器
    const renderer = new marked.Renderer();
    renderer.code = (code) => {
      const language = code.lang;
      if (language === "mermaid" || language === "svg") {
        // 保护特殊代码块不被 markdown 处理
        return `<protected-block type="${language}">${this.escapeHtml(
          code.text
        )}</protected-block>`;
      }
      return `<pre><code class="language-${language}">${this.escapeHtml(
        code.text
      )}</code></pre>`;
    };
    marked.use({ renderer });
  }

  async process(content) {
    try {
      // 确保输入是字符串
      content = String(content || "");
      
      // 1. 处理特殊标记

      content = content.replace(/\$([\s\S]+?)\$\$?/g, (match, p1) => {
        console.log(match);
        return `<protected-block type="math">${this.escapeHtml(match)}</protected-block>`;
      });

      content = this.processSpecialContent(content);


      // 2. Markdown 渲染，此时特殊代码块被保护
      content = marked.parse(content);


      // 3. 处理被保护的代码块
      content = await this.processProtectedBlocks(content);

      return content;
    } catch (err) {
      console.error("内容处理失败:", err);
      return `<div class="error">内容处理失败: ${err.message}</div>`;
    }
  }

  processSpecialContent(content) {
    // 终止符与深度思考
    if (!content) return "";
    return content.replace(/\[已终止\]$/, '<span class="stopped-label">已终止</span>').replace(
      /<think>([\s\S]*?)<\/think>|<think>([\s\S]*?)$/g,
      (match, closed, open) => {
        const thinkContent = closed || open || "";
        // console.log(thinkContent);
        return `<div class="fold-content ${closed ? "collapsed" : "thinking"}" onclick="if($(this).hasClass('collapsed')) $(this).find('.fold-toggle').click();">
                    <div class="fold-header">
                        <span class="fold-title">深度思考</span>
                        <button class="fold-toggle" onclick="$(this.parentElement.parentElement).toggleClass('collapsed');$(this).find('.sfi').toggleClass('down');event.stopPropagation();">
                            <span class="sfi ${closed ? "chevron-down" : "chevron-up"}">${closed ? "&#xE70D;" : "&#xE70E;"}</span>
                        </button>
                    </div>
                    <div class="fold-body">${marked.parse(thinkContent)}</div>
                </div>`;
      }
    );
  }

  async processProtectedBlocks(content) {
    const regex =
      /<protected-block type="(.*?)">([\s\S]*?)<\/protected-block>/g;
    let match;
    let processedContent = content;

    while ((match = regex.exec(content)) !== null) {
      const [fullMatch, type, code] = match;
      const decodedCode = this.unescapeHtml(code).replace(/\<br\>/g, '\n');
      let replacement = "";

      try {
        if (type === "mermaid") {
          const { svg } = await this.renderMermaid(decodedCode);
          replacement = this.wrapInPreview("Mermaid", decodedCode, svg);
        } else if (type === "svg") {
          replacement = this.wrapInPreview("SVG", decodedCode, decodedCode);
        }else{
          replacement=decodedCode;
          console.log(fullMatch,type,decodedCode)
        }
      } catch (err) {
        // console.error(`${type} 渲染失败:`, err);
        replacement = this.wrapInPreview(
          `${type} (渲染失败)`,
          decodedCode,
          `<div class="error">渲染失败: ${err.message}</div>`
        );
      }

      processedContent = processedContent.replace(fullMatch, () => replacement); // js 的奇妙思路，直接用字符串传参会被误解析
    }

    return processedContent;
  }

  async renderMermaid(code) {
    if (!code) throw new Error("空的 Mermaid 代码");
    const id = `mermaid-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    return await mermaid.render(id, code);
  }

  wrapInPreview(title, code, rendered) {
    return `
            <div class="preview-container">
                <div class="preview-header">
                    <span class="preview-title">${title}</span>
                    <button class="preview-toggle button">
                        <span class="sfi">&#xE8AF;</span>
                        <span class="text">查看代码</span>
                    </button>
                </div>
                <div class="preview-content">
                    <pre><code class="language-${title.toLowerCase()}">${this.escapeHtml(
      String(code)
    )}</code></pre>
                    <div class="rendered ${title.toLowerCase()}-container">${rendered}</div>
                </div>
            </div>
        `;
  }

  escapeHtml(str) {
    if (typeof str !== "string") {
      console.warn("escapeHtml: 输入不是字符串:", str);
      str = String(str || "");
    }
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  unescapeHtml(str) {
    if (typeof str !== "string") {
      console.warn("unescapeHtml: 输入不是字符串:", str);
      str = String(str || "");
    }
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  // 添加数学公式渲染方法
  renderMath(element) {
    // return;
    if (!element) return;
    renderMathInElement(element, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  // 添加代码高亮方法
  highlightCode($content) {
    $content.find("pre code").each((_, block) => {
      if (Prism) {
        Prism.highlightElement(block);
      }
    });
  }

  // 初始化KaTeX
  initKaTeX() {
    // renderMathInElement(document.body, {
    //   delimiters: [
    //     { left: "$$", right: "$$", display: true },
    //     // {left: '[', right: ']', display: true},
    //     // {left: '( ', right: ' )', display: false},
    //     { left: "$", right: "$", display: false },
    //   ],
    //   throwOnError: false,
    // });
  }

  bindCodeEvents($message) {
      // Mermaid/SVG 预览的切换
      $message.find(".preview-container").each((_, container) => {
        
        const $container = $(container);
        const $content = $container.find(".preview-content");
        const $toggle = $container.find(".preview-toggle");
        // 点击切换按钮
        $toggle.off("click").on("click", () => {
          $content.toggleClass("show-code");
          const isShowingCode = $content.hasClass("show-code");
          $toggle.find("span.text").text(isShowingCode ? "查看效果" : "查看代码");
        });
      });

      // 为每个代码块添加复制按钮
      $message.find("pre code").each(function () {
        const $code = $(this);
        // 避免重复添加
        // if ($code.parent().find(".copy-code-btn").length === 0) {
          const $btn = $('<button class="copy-code-btn" title="复制代码"><span class="sfi">&#xE8C8;</span></button>');
          // 代码块父元素需要 position: relative
          $code.parent().append($btn);

          $btn.on("click", function (e) {
            e.stopPropagation();
            navigator.clipboard.writeText($code.text());
            $btn.attr("title", "已复制！").addClass("copied");
            setTimeout(() => {
              $btn.attr("title", "复制代码").removeClass("copied");
            }, 1500);
          });
        // }
      });
    }


}

class Chat {
  constructor() {
    
  }

  

}