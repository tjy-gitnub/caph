var toBottom = true;
class Dom {
  constructor() { }

  setupScrollToBottom(){
    $('#chat-messages').on('scroll',()=>{
      const container = $("#chat-messages");
      const scrollBottom = container[0].scrollHeight - container.scrollTop() - container.outerHeight();
      toBottom = scrollBottom < 25;
    });
    $('#scroll-to-bottom').hide();
  }
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
  scrollToBottom(force=false) {
    const container = $("#chat-messages");
    const $stb=$('#scroll-to-bottom');
    if (toBottom || force) {
      container.scrollTop(container[0].scrollHeight);
      if($stb.is(':visible')){
        $stb.hide();
      }
    } else {
      if(!$stb.is(':visible')){
        $stb.show();
      }
    }
  }

  setLoading(loading) {
    isProcessing = loading;
    if (loading) {
      pausingForToolCall = false;
      $('#send-button,#toggle-tool').removeAttr('disabled');
    }
    $("#input-container").toggleClass("loading", loading);
    if (!pausingForToolCall)
      $('#send-button').toggleClass('red', loading)
        .html(loading ? '<span class="sfi">&#xEE95;</span> 停止' : '<span class="sfi">&#xE724;</span> 发送');
    $('#open-settings,#more-button,.message-toolbar>.toolbar-button,#open-about').prop('disabled', isProcessing || pausingForToolCall);
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
      $('#send-button,#export-conversation').attr('disabled', true);
      return;
    } else {
      $("#chat-header").removeClass("greeting");
      $('#send-button,#export-conversation').removeAttr('disabled');
    }
    // 更新当前模型和局部设置显示（使用 pid）
    currentModelPid = convManager.getActive()?.model ?? defaultModelPid;
    console.log(currentModelPid);
    $("#current-model").html(`<span class="name">${configUtils.findModelByPid(currentModelPid).name}</span>`);
    // 加载消息
    chatHistory = Array.isArray(active.messages) ? active.messages.slice() : [];
    this.renderChatHistory();
    $('#current-cwd').text(convManager.getcwd() || '文档');
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
                ${window.configUtils.findModelByPid(currentModelPid).name
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
    this.scrollToBottom(true);
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
      processedContent = `
        <div class="tool-description">
            ${message.description}
        </div>
        <div class="fold-content collapsed" onclick="if($(this).hasClass('collapsed')) $(this).find('.fold-toggle').click();">
          <div class="fold-header">
              <span class="fold-title">返回结果</span>
              <button class="fold-toggle" onclick="$(this.parentElement.parentElement).toggleClass('collapsed');$(this).find('.sfi').toggleClass('down');event.stopPropagation();">
                  <span class="sfi">&#xE70D;</span>
              </button>
          </div>
          <div class="fold-body">
            <pre class="tool-result">${processedContent}</pre>
          </div>
        </div>`;
      $content.html(processedContent);
    } else {
      if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
        const name = message.tool_calls.length > 1 ? message.tool_calls.length + '个' : message.tool_calls[0].function.name;
        processedContent += `<div class="label lb-toolcall"><span class=sfi>&#xE90F;</span><span>使用工具</span><span class=name>${name}</span></div>`;
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
    $message.find(".copy-button").click(() => {
      navigator.clipboard.writeText(message.content);
    });

    $message.find(".delete-button").click(() => deleteMessage(message.id));
    $message.find(".edit-button").click(() => this.startEditing(message.id));

    // AI消息的重试按钮
    $message.find(".retry-button").click(() => retryMessage(message.id));
  }

  // 消息元素的模板
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
    } else if (message.role === "system") {
      return $(
        `
            <div class="message system" data-id="${message.id}">
                <div class="message-content"></div>
            </div>
        `
      );

    } else {
      senderName = configUtils.findModelByPid(message.model).name || "AI";
    }

    return $(`
      <div class="message ${message.role} ${(message.role == 'assistant' && message.tool_calls) ? 'tool-calls' : ''}" data-id="${message.id}">
          <div class="message-header">
              <span class="message-sender">${senderName}</span>` + `
          </div>
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
          </div>` : '') + `
      </div>`);
  }

  showModelDropdown(targetEl, input_container = false) {
    if ($(".model-dropdown").length) {
      $(".model-dropdown").remove();
      return;
    }
    const $dropdown = $('<div class="model-dropdown list"></div>');
    settings_data.modelList.forEach((m, idx) => {
      const activeClass = (Number(currentModelPid) === Number(m.pid)) ? "active" : "";
      const $item = $(`<div class="a ${activeClass}" data-model-id="${m.pid}">
        ${m.name}
        <span class="id" style="opacity:.6;font-size:12px;margin-left:6px;">
          ${configUtils.getProviderByKey(m.provider)?.name}
        </span>
      </div>`);
      $item.on("click", (e) => {
        e.stopPropagation();
        selectModel(m.pid);
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
      <a class="lnkbtn" onclick="window.cefBridge.openUrl('https://docs.github.com/zh/github-models/use-github-models/prototyping-with-ai-models#rate-limits')">Github 模型额度</a>
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

    if (localStorage.getItem("enableTool") === null) {
      localStorage.setItem("enableTool", "true");
    }

    const toolCallEnabled = localStorage.getItem("enableTool") === "true";
    $("#toggle-tool").toggleClass("primary", toolCallEnabled);
    $('#input-container>.attachment>.cwd').toggle(toolCallEnabled);

    $("#toggle-tool").on("click", function () {
      $(this).toggleClass("primary");
      const enabled = $(this).hasClass("primary");
      localStorage.setItem("enableTool", enabled ? "true" : "false");
      $('#input-container>.attachment>.cwd').toggle(enabled);
    });

    // 初始化选择模型（使用 pid）
    selectModel(currentModelPid);

    // 设置按钮
    $("#open-settings").click(() => settingManager.openSettings());
    $("#close-settings").click(() => settingManager.closeSettings());
    $("#save-settings").click(() => settingManager.saveSettings());

    // 设置界面事件
    $(".settings-menu-item").click(function () {
      $(".settings-menu-item").removeClass("active");
      $(this).addClass("active");

      const section = $(this).data("section");
      $(".settings-section").removeClass("active");
      $(`#${section}-settings`).addClass("active").parent().scrollTop(0);
    });

    // 温度滑块
    $("#setting-temperature").on("input", function () {
      $(".range-value").text(this.value);
    });

    // 实时更新温度值显示
    $("#setting-temperature").on("input", function () {
      $(this).closest(".range-slider").find(".range-value").text(this.value);
    });

    // 点击当前模型显示模型下拉
    $("#current-model").on("click", (e) => {
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

  }

  // 设置输入框自动调整高度
  setupAutoResize() {
    const textarea = $("#message-input")[0];
    const setHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + 3 + "px";
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

  // 创建工具调用确认卡片
  createToolCard(buffer) {
    const $card = $(`
      <div class="message tool waiting-confirmation">
        <div class="message-header">
        <span class="sfi">&#xE90F;</span><span style="font-weight:600;" class="tool-name">${buffer.name}</span>
          <div class="tool-state" style="opacity:0.8;font-size:13px;text-align: end;flex:1;">等待确认</div>
        </div>
        <div class="message-content" style="white-space:pre-wrap;">${buffer.arguments}</div>
        <div class="actions">
          <button class="button primary tool-approve" title="同意并运行" disabled>同意</button>
          <button class="button tool-cancel" title="拒绝" disabled>拒绝</button>
        </div>
      </div>
    `);

    // 绑定按钮事件，使用传入回调（若存在）
    $card.find(".tool-approve").click(async (e) => {
      e.stopPropagation();
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", true);
      await buffer.onApprove($card);
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", false);
    });
    $card.find(".tool-cancel").click((e) => {
      e.stopPropagation();
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", true);
      buffer.onDeny($card);
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", false);
    });

    $("#chat-messages").append($card);
    this.scrollToBottom();
    return $card;
  }

  // 流式响应更新参数内容
  updateToolCardPreview($card, buffer) {
    $card.find(".tool-name").text(buffer.name);
    $card.find(".message-content").text(buffer.arguments);
  }

  updateToolCardState($card, state) {
    const $state = $card.find(".tool-state");
    if (state === "confirm") {
      $state.text("等待确认");
    } else if (state === "loading") {
      $state.text("执行中...");
    } else if (state === "done") {
      $state.text("已完成");
      $card.removeClass("waiting-confirmation");
    }
  }

  updateToolCallResultAndRemove($card) {
    if ($('.multiple-tool-calls').length) {
      const $count = $('.multiple-tool-calls').find('.tool-count');
      if (parseInt($count.text()) > 1)
        $count.text(
          parseInt($count.text()) - 1
        );
      else {
        $('.multiple-tool-calls').remove();
      }
    }
    $card.remove();
  }

  pauseForToolCall() {
    $(".tool-approve,.tool-cancel").prop("disabled", false);
    pausingForToolCall = true;
    $('#send-button,#toggle-tool').prop('disabled', true);
  }

  arrangeMultipleToolCards(tools, toolCardEl, finishedToolCalls) {
    const $total = $(`
      <div class="multiple-tool-calls">
        <div class="text"><span class="tool-count">${tools.length}</span> 个调用待确认</div>
        <div class="actions">
          <button class="button primary tool-approve-all" title="同意全部">同意全部</button>
          <button class="button tool-cancel-all" title="拒绝全部">拒绝全部</button>
        </div>
      </div>
    `);

    $total.find(".tool-approve-all").click(async (e) => {
      e.stopPropagation();
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", true);
      for (let i = 0; i < tools.length; i++) {
        if (finishedToolCalls[i]) continue;
        const buffer = tools[i];
        await buffer.onApprove(toolCardEl[i]);
      }
    });

    $total.find(".tool-cancel-all").click((e) => {
      e.stopPropagation();
      $(".tool-approve,.tool-cancel,.tool-approve-all,.tool-cancel-all").prop("disabled", true);

      for (let i = 0; i < tools.length; i++) {
        if (finishedToolCalls[i]) continue;
        console.log(':::', i);
        const buffer = tools[i];
        buffer.onDeny(toolCardEl[i]);
      }

    });

    $("#chat-messages").append($total);
    this.scrollToBottom();
  }

  // 手动选择工作目录
  selectCwd() {
    window.cefBridge.selectFolder().then(cwd => {
      if (typeof cwd !== 'string' || !cwd.trim()) return;
      const conv = convManager.getActive();
      if (!conv) return;
      const systemMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        content: `工作目录已切换到 ${cwd}`,
        isUser: false,
        role: 'system',
        timestamp: new Date().toISOString(),
        cwd: cwd,
      }
      chatHistory.push(systemMessage);
      let index = chatHistory.length - 1;
      while (index > 0) {
        index--;
        if (chatHistory[index].role === 'system' && chatHistory[index].cwd) {
          chatHistory.splice(index, 1);
        }
      }
      saveHistory();
      convManager.triggerChange();
    });
  }
}