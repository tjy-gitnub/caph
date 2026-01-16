class Dom {
  constructor() { }
  // 消息编辑
  startEditing(messageId) {
    if (editingMessageId) return;
    editingMessageId = messageId;

    const $message = $(`[data-id="${messageId}"]`);
    const $content = $message.find(".message-content");
    const originalContent = chatHistory.find((m) => m.id === messageId).content;

    $content.after(`
            <div class="edit-container">
                <textarea class="edit-input textarea textarea-like">${originalContent}</textarea>
                <div class="edit-tools">
                    <button class="toolbar-button save" title="保存">
                        <span class="sfi">&#xE8FB;</span>
                    </button>
                    <button class="toolbar-button cancel" title="取消">
                        <span class="sfi">&#xE711;</span>
                    </button>
                </div>
            </div>
        `);
    $content.hide();

    // 绑定编辑事件
    const $editContainer = $message.find(".edit-container");
    $editContainer.find(".edit-input").focus();
    $editContainer.find(".save").click(() => this.saveEdit(messageId));
    $editContainer.find(".cancel").click(() => this.cancelEdit(messageId));
  }

  async saveEdit(messageId) {
    const $message = $(`[data-id="${messageId}"]`);
    const $editContainer = $message.find(".edit-container");
    const newContent = $editContainer.find(".edit-input").val();
    const messageIndex = chatHistory.findIndex((m) => m.id === messageId);

    if (messageIndex !== -1) {
      // 更新消息内容
      chatHistory[messageIndex].content = newContent;

      // 如果是用户消息
      if (chatHistory[messageIndex].isUser) {
        // 删除之后的消息
        chatHistory = chatHistory.slice(0, messageIndex + 1);
        await this.renderChatHistory();

        // 重新发送
        await sendToServer(chatHistory[messageIndex]);
      } else {
        // 如果是AI消息，仅更新显示
        this.renderMessageElement(chatHistory[messageIndex])
          .then(($newMessage) => {
            $message.replaceWith($newMessage);
          });
      }

      saveHistory();
    }

    editingMessageId = null;
  }

  cancelEdit(messageId) {
    const $message = $(`[data-id="${messageId}"]`);
    $message.find(".edit-container").remove();
    $message.find(".message-content").show();
    editingMessageId = null;
  }

  // 辅助方法
  scrollToBottom() {
    const container = $("#chat-messages");
    container.scrollTop(container[0].scrollHeight);
  }

  setLoading(loading) {
    isProcessing = loading;
    $("#input-container").toggleClass("loading", loading);
    $('#send-button').toggleClass('red', loading)
      .html(loading ? '<span class="sfi">&#xEE95;</span> 停止' : '<span class="sfi">&#xE724;</span> 发送');
    // $("#send-button").prop("disabled", loading);
  }

  // 加载模型列表
  loadModels() {
    const $selector = $("#model-selector");
    $selector.empty();

    Object.entries(settings_data.models).forEach(([id, name]) => {
      const $model = $("<div>")
        .addClass("a")
        .attr("data-model-id", id)
        .text(name)
        .click(() => selectModel(id));

      $selector.append($model);
    });
    selectModel(currentModel);
  }

  // 当会话切换或元数据变化时，更新 chatManager 的状态并重新加载历史
  onConversationChanged() {
    const active = convManager.getActive();
    if (!active) {
      $("#chat-messages")
        .empty()
        .append(
          $(`<div id="greeting-empty">
            <p class="title">欢迎使用 Caph</p>
            <p style="display:inline">请新建对话开始聊天。</p>
          </div>`)
        );
      $("#chat-header").addClass("greeting");
      this.setLoading(true);
      return;
    } else {
      $("#chat-header").removeClass("greeting");
      this.setLoading(false);
    }
    // 更新当前模型和局部设置显示
    currentModel = active.model || defaultModel;
    // update UI for current-model
    const modelName =
      settings_data.models[currentModel] || currentModel || "AI";
    $("#current-model").html(`<span class="name">${modelName}</span>`);
    // 加载消息
    chatHistory = Array.isArray(active.messages) ? active.messages.slice() : [];
    this.renderChatHistory();
  }

  // 历史记录渲染
  async renderChatHistory() {
    console.log("Render history:", chatHistory);
    const $messagesContainer = $("#chat-messages");
    $messagesContainer.empty();
    let lastTimestamp = null;

    for (const message of chatHistory) {
      const currentTime = new Date(message.timestamp).getTime();

      if (!lastTimestamp || currentTime - lastTimestamp > 180000) {
        const $timeDiv = $("<div>")
          .addClass("time-divider")
          .text(new Date(currentTime).toLocaleTimeString());
        $messagesContainer.append($timeDiv);
      }

      lastTimestamp = currentTime;
      try {
        const $messageElement = await this.renderMessageElement(message);
        $messagesContainer.append($messageElement);
      } catch (err) {
        console.error("渲染消息失败:", err, message);
        // 添加错误提示消息
        $messagesContainer.append(
          $("<div>")
            .addClass("message error")
            .text(`消息渲染失败: ${err.message}`)
        );
      }
    }
    if (chatHistory.length === 0) {
      $messagesContainer.append(
        $(`<div id="greeting">
            <p class="title">开始与 AI 对话！</p>
            <p style="display:inline">正在与 <div class="model-name"><span class="name">
                ${settings_data.models[currentModel] || currentModel
          }</span></div>
                交流</p>
            </div>`)
      );
      $("#chat-header").addClass("greeting");
      $("#greeting .model-name").on("click", (e) => {
        e.stopPropagation();
        this.showModelDropdown(e.currentTarget);
      });
    } else {
      $("#chat-header").removeClass("greeting");
    }

    this.scrollToBottom();
  }

  // 历史消息渲染函数
  async renderMessageElement(message) {
    // 基础消息结构
    const $message = this.createMessageElement(message);

    // 处理消息内容
    const $content = $message.find(".message-content");

    let processedContent = await this.processMessageContent(
      message
    );


    if (message.isUser) {
      $content.text(processedContent);
    } else if (message.role === 'tool') {
      processedContent = `<div class="fold-content collapsed" onclick="if($(this).hasClass('collapsed')) $(this).find('.fold-toggle').click();">
                    <div class="fold-header">
                        <span class="fold-title">返回结果</span>
                        <button class="fold-toggle" onclick="$(this.parentElement.parentElement).toggleClass('collapsed');$(this).find('.sfi').toggleClass('down');event.stopPropagation();">
                            <span class="sfi chevron-down">&#xE70D;</span>
                        </button>
                    </div>
                    <pre class="fold-body tool-result">${processedContent}</pre>
                </div>`
      $content.html(processedContent);
    } else {
      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        const name = message.tool_calls.length>1?message.tool_calls.length+'个':message.tool_calls[0].function.name;
        processedContent += `<div class="inline-tool"><span class=sfi>&#xE90F;</span><span>使用工具</span><span class=name>${name}</span></div>`;
        // 不渲染数学公式或代码高亮（工具调用的内容由卡片展示）
        // this.bindMessageToolbarEvents($message, message);
        // return $message;
      }
      $content.html(processedContent);
    }

    // 为非用户消息添加数学公式渲染和代码高亮
    if (!message.isUser) {
      try {
        // 渲染数学公式
        contentProcessor.renderMath($content[0]);

        // 高亮代码
        contentProcessor.highlightCode($content);

        contentProcessor.bindCodeEvents($message);
      } catch (err) {
        console.warn("渲染失败:", err);
      }
    }

    // 绑定工具栏事件
    if (message.role != 'tool')
      this.bindMessageToolbarEvents($message, message);

    return $message;
  }

  showError(message) {
    const $errorDiv = $("<div>")
      .addClass("message error")
      .append($("<div>").addClass("message-content error").text(message));

    $("#chat-messages").append($errorDiv);
    this.scrollToBottom();
  }

  // 更新消息工具栏事件绑定
  bindMessageToolbarEvents($message, message) {
    // const isUser = message.isUser;

    $message.find(".copy-button").click(() => {
      navigator.clipboard.writeText(message.content);
    });

    $message.find(".delete-button").click(() => deleteMessage(message.id));
    $message.find(".edit-button").click(() => this.startEditing(message.id));

    // AI消息的重试按钮
    // if (!message.isUser) {
    $message.find(".retry-button").click(() => retryMessage(message.id));
    // }
  }

  // 统一的消息模板
  createMessageElement(message) {
    let senderName;
    if (message.isUser) {
      senderName = "用户";
    } else if (message.role === "tool") {
      return $(`
      <div class="message tool">
        <div class="message-header">
          <span class="sfi">&#xE90F;</span><span style="font-weight:600;">${message.tool || '?'}</span>
        </div>
        <div class="message-content">${message.content}</div>
      </div>`);
    } else {
      senderName = settings_data.models[message.model] || message.model || "AI";
    }

    return $(
      `
            <div class="message ${message.role} ${(message.role == 'assistant' && message.tool_calls) ? 'tool-calls' : ''}" data-id="${message.id}">
                <div class="message-header">
                    <span class="message-sender">${senderName}</span>` +
      `</div>
                <div class="message-content"></div>
               `+ (message.role != 'tool' ? `
                <div class="message-toolbar">
                    <button class="toolbar-button delete-button" title="删除">
                        <span class="sfi">&#xE74D;</span>
                    </button>
                    <button class="toolbar-button copy-button" title="复制">
                        <span class="sfi">&#xE8C8;</span>
                    </button>
                    <button class="toolbar-button retry-button" title="重试">
                        <span class="sfi">&#xE895;</span>
                    </button>
                    <button class="toolbar-button edit-button" title="编辑">
                        <span class="sfi">&#xE70F;</span>
                    </button>
                </div>`:
        '')
      + `
            </div>
        `
    );
  }

  
  showModelDropdown(targetEl, input_container = false) {
    if ($(".model-dropdown").length) {
      $(".model-dropdown").remove();
      return;
    }
    const $dropdown = $('<div class="model-dropdown list"></div>');
    Object.entries(settings_data.models).forEach(([id, name]) => {
      const $item = $(
        `<div class="a ${currentModel === id ? "active" : ""
        }" data-model-id="${id}">${name} <span class="id" style="opacity:.6;font-size:12px;margin-left:6px;">${id}</span></div>`
      );
      $item.on("click", (e) => {
        e.stopPropagation();
        selectModel(id);
        $dropdown.remove();
      });
      $dropdown.append($item);
    });
    $dropdown.append(`<div style="display: flex;">
      <a class="lnkbtn" onclick="
      $('.model-dropdown').remove();
      settingManager.openSettings();
      // setTimeout(() => {
            $('.settings-menu-item').removeClass('active');
            $('.settings-menu-item[data-section=models]').addClass('active');
            $('.settings-section').removeClass('active');
            $('#models-settings').addClass('active');
      // }, 300);
      "><span class="sfi">&#xF0E2;</span>管理模型</a>
      <a class="lnkbtn" onclick="window.open('https://docs.github.com/zh/github-models/use-github-models/prototyping-with-ai-models#rate-limits', '_blank')">Github 模型额度</a>
    </div>`);
    if (input_container) {
      console.log('a');
      $("#chat-messages").after($dropdown);
    } else {
      $("body").append($dropdown);
      const rect = targetEl.getBoundingClientRect();
      $dropdown.css({ top: rect.bottom + 5 + "px" });
    }
  }


  // 更新事件监听
  setupEventListeners() {
    $("#send-button").click(() => handleSendMessage());

    $("#message-input").on("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isProcessing) handleSendMessage();
      }
    });

    if(localStorage.getItem("enableTool")===null){
      localStorage.setItem("enableTool","true");
    }
    $("#toggle-tool").toggleClass("primary",localStorage.getItem("enableTool")==="true");

    $("#toggle-tool").on("click",function(){
      $(this).toggleClass("primary");
      const enabled=$(this).hasClass("primary");
      localStorage.setItem("enableTool",enabled?"true":"false");
    });

    // 加载模型列表
    this.loadModels();

    // 设置按钮
    $("#open-settings").click(() => settingManager.openSettings());
    $("#close-settings").click(() => settingManager.closeSettings());
    $("#save-settings").click(() => settingManager.saveSettings());

    // token 输入同步
    $("#token").on("change", (e) => {
      ghtoken = e.target.value;
      localStorage.setItem("ghtoken", ghtoken);
    });

    // 设置界面事件
    $(".settings-menu-item").click(function () {
      $(".settings-menu-item").removeClass("active");
      $(this).addClass("active");

      const section = $(this).data("section");
      $(".settings-section").removeClass("active");
      $(`#${section}-settings`).addClass("active");
    });

    // 温度滑块
    $("#setting-temperature").on("input", function () {
      $(".range-value").text(this.value);
    });

    $("#model-list").on("click", ".delete-model", function () {
      $(this).closest(".model-card").remove();
    });

    // 实时更新温度值显示
    $("#setting-temperature").on("input", function () {
      $(this).closest(".range-slider").find(".range-value").text(this.value);
    });

    // 点击当前模型显示模型下拉（从 settings.models 中读取）
    $("#current-model").on("click", (e) => {
      // e.stopPropagation();
      this.showModelDropdown(e.currentTarget, true);
    });

    // 导出当前会话按钮（header 中的按钮，见 HTML）
    $("#export-conversation").click(() => {
      const payload = convManager.exportActiveConversation();
      if (!payload) {
        this.showError("没有要导出的会话");
        return;
      }
      const fname = (payload.name || "conversation") + ".json";
      convManager.downloadObjectAsJson(payload, fname);
    });

    // 导入文件选择
    $("#import-file").on("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      convManager
        .importFromFile(file)
        .then(() => {
          // 刷新会话并加载
          this.onConversationChanged();
        })
        .catch((err) => {
          console.error("导入失败:", err);
          this.showError("导入失败: " + err.message);
        })
        .finally(() => {
          $("#import-file").val("");
        });
    });

    $("#more-button").on("click", (e) => {
      // e.stopPropagation();
      $("#sidebar").toggleClass("open");
    });

    // 移除对 #more-panel-save 的依赖（保存操作改为点击外部时自动应用）
    // 点击页面其它地方关闭面板/下拉
    $(document).on("click", (e) => {
      const $t = $(e.target);
      const clickedInMore =
        $t.closest("#sidebar").length > 0 ||
        $t.closest("#more-button").length > 0;
      const clickedInDropdown =
        $t.closest(".model-dropdown").length > 0 ||
        $t.closest("#current-model").length > 0;

      if (!clickedInDropdown) {
        $(".model-dropdown").remove();
      }

      if (!clickedInMore) {
        $("#sidebar").removeClass("open");
      }
    });

    // 防止在面板内点击导致被 document 的全局点击处理关闭（即点击 input 时不会立即消失）
    $("#more-panel").on("click", (e) => {
      e.stopPropagation();
    });

    // 关于
    $("#open-about").click((e) => {
      e.stopPropagation();
      $("#about-modal").fadeIn(100);
      $("#app").removeClass("show");
    });

    $(document).on("click", "#about-close", () => {
      $("#about-modal").fadeOut(100);
      $("#app").addClass("show");
    });
  }

  // 设置输入框自动调整高度
  setupAutoResize() {
    const textarea = $("#message-input")[0];
    const setHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + 3 + "px";
      // $("#chat-messages").css("padding-bottom", textarea.scrollHeight);
    };

    $("#message-input").on("input", setHeight);
  }

  // 历史消息内容处理函数
  async processMessageContent(message) {
    try {
      if (message.role != 'assistant') {
        return message.content; // 用户/工具 直接返回文本
      }
      return await contentProcessor.process(message.content);
    } catch (err) {
      console.error("处理消息内容失败:", err);
      return `<div class="error">内容处理失败: ${err.message}</div>`;
    }
  }

  // 新增：创建工具调用确认卡片（支持传入对象或旧签名）
  createToolCard(arg1, arg2) {
    // 支持两种调用方式： createToolCard({name, argsText, onApprove, onDeny, beforeEl})
    // 或 createToolCard(name, argsText)
    let name, argsText, onApprove, onDeny, beforeEl;
    if (typeof arg1 === "object" && arg1 !== null) {
      name = arg1.name || "";
      argsText = arg1.argsText || arg1.argsPreview || "";
      onApprove = arg1.onApprove;
      onDeny = arg1.onDeny;
      beforeEl = arg1.beforeEl; // 可选，jQuery 元素或选择器
    } else {
      name = arg1 || "";
      argsText = arg2 || "";
    }

    const $card = $(`
      <div class="message tool waiting-confirmation">
        <div class="message-header">
        <span class="sfi">&#xE90F;</span><span style="font-weight:600;">${name}</span>
          <div class="tool-state" style="opacity:0.8;font-size:13px;text-align: end;flex:1;">等待确认</div>
        </div>
        <div class="message-content" style="white-space:pre-wrap;">${argsText}</div>
        <div class="actions">
          <button class="button primary tool-approve" title="同意" disabled>同意</button>
          <button class="button tool-cancel" title="拒绝" disabled>拒绝</button>
        </div>
      </div>
    `);

    // 绑定按钮事件，使用传入回调（若存在）
    $card.find(".tool-approve").click((e) => {
      e.stopPropagation();
      $card.find(".tool-approve,.tool-cancel").prop("disabled", true);
      onApprove($card);
    });
    $card.find(".tool-cancel").click((e) => {
      e.stopPropagation();
      $card.find(".tool-approve,.tool-cancel").prop("disabled", true);
      onDeny($card);
    });

    // 插入位置：优先 beforeEl（若指定），否则如果有正在流式的 AI 消息则放在其后，否则追加到消息列表末尾
    if (beforeEl && beforeEl.length) {
      $(beforeEl).before($card);
    } else {
      const $streaming = $(".message.assistant.streaming");
      if ($streaming.length) {
        $streaming.after($card);
      } else {
        $("#chat-messages").append($card);
      }
    }
    this.scrollToBottom();
    return $card;
  }

  updateToolCardPreview($card, argsText) {
    $card.find(".message-content").text(argsText);
  }

  updateToolCardState($card, state) {
    const $state = $card.find(".tool-state");
    if (state === "confirm") {
      $state.text("等待确认");
    } else if (state === "loading") {
      $state.text("执行中...");
    }else if (state === "done") {
      $state.text("已完成");
      $card.removeClass("waiting-confirmation");
    }
  }

  updateToolCardResultWithDone($card) {
    if ($('.multiple-tool-calls').length) {
      console.log('Updating multiple tool calls card');
      const $count=$('.multiple-tool-calls').find('.tool-count');
      if(parseInt($count.text())>1)
        $count.text(
          parseInt($count.text()) - 1
        );
      else {
        $('.multiple-tool-calls').remove();
      }
    }
    $card.remove();
  }

  enableToolCardActions(cardlist){
    cardlist.forEach(($card) => {
      $card.find(".tool-approve,.tool-cancel").prop("disabled", false);
    });
  }

  arrangeMultipleToolCards(num) {
    const $total = $(`
      <div class="multiple-tool-calls">
        <div class="text">待确认：<span class="tool-count">${num}</span> 个工具调用</div>
        <div class="actions">
          <button class="button primary tool-approve-all" title="同意全部">同意全部</button>
          <button class="button tool-cancel-all" title="拒绝全部">拒绝全部</button>
        </div>
      </div>
    `);

    $total.find(".tool-approve-all").click((e) => {
      e.stopPropagation();
      $(".tool-approve").click();
    });
    $total.find(".tool-cancel-all").click((e) => {
      e.stopPropagation();
      $(".tool-cancel").click();
    });
    $("#chat-messages").append($total);
  }
}