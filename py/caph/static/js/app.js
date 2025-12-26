dom = new Dom();

chatHistory = []; // 当前对话消息历史
isProcessing = false; // 消息处理状态标志
editingMessageId = null; // 正在编辑的消息ID

window.settingManager = new Settings();

// 从 localStorage 恢复或初始化设置
settings_data = settingManager.getSettings();

// 颜色主题设置
if (settings_data.autoTheme) {
  // 自动根据系统主题切换
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-theme",
    prefersDark ? "dark" : "light"
  );
} else if (settings_data.theme) {
  document.documentElement.setAttribute("data-theme", settings_data.theme);
}

// 对话管理器（全局实例）
convManager = window.conversationManager;
console.log(convManager);

// 确定当前使用的模型（优先级：当前会话 > 本地存储 > 设置 > 默认）
const activeConv = convManager.getActive();
defaultModel =
  activeConv?.model ||
  localStorage.getItem("defaultModel") ||
  (settings_data.models && Object.keys(settings_data.models)[0]) ||
  "deepseek/DeepSeek-R1";
currentModel =
  activeConv?.model || localStorage.getItem("defaultModel") || defaultModel;

// 处理 GitHub Token
if (GITHUB_TOKEN != "__your_gh_token__") {
  ghtoken = GITHUB_TOKEN;
  $("#token-error").hide();
} else {
  ghtoken = localStorage.getItem("ghtoken");
  if (!ghtoken) {
    $("#token-error").show();
  }
}
contentProcessor = new ContentProcessor(); // 内容处理器（Markdown、代码高亮等）

document.addEventListener("DOMContentLoaded", () => {
  // 初始化
  dom.setupEventListeners();
  // loadHistory();
  dom.setupAutoResize();

  contentProcessor.initKaTeX(); // 初始化数学公式渲染
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
  });
});

/**
 * 添加消息到历史并渲染
 * @param {string} content 消息内容
 * @param {boolean} isUser 是否为用户消息
 * @returns {object} 消息对象
 */
function addMessage(content, isUser) {
  const message = createMessage(content, isUser);
  chatHistory.push(message);
  // 立即渲染消息
  dom.renderMessageElement(message).then(($messageElement) => {
    $("#chat-messages").append($messageElement);
    dom.scrollToBottom();
  });
  saveHistory();
  return message;
}

/**
 * 创建消息对象
 * @param {string} content 消息内容
 * @param {boolean} isUser 是否为用户消息
 */
function createMessage(content, isUser) {
  return {
    id: Date.now() + Math.random().toString(36).substr(2, 9), // 生成唯一ID
    content,
    isUser,
    role: isUser ? "user" : "assistant", // 记录具体的assistant角色
    timestamp: new Date().toISOString(),
    model: !isUser ? currentModel : null, // 记录使用的模型
  };
}

/**
 * 处理发送消息
 */
async function handleSendMessage() {
  const input = $("#message-input");
  const content = input.val().trim();
  if (!content) return;

  input.val("").trigger("input");

  // 如果当前是欢迎界面，清空并切换到聊天界面
  if ($("#chat-messages").children()[0].id == "greeting") {
    $("#chat-messages").empty();
    $("#chat-header").removeClass("greeting");
  }

  // 检查是否为命令（以/开头）
  if (content.startsWith("/")) {
    handleCommand(content);
    return;
  }

  try {
    // 添加用户消息
    const userMessage = addMessage(content, true);

    // 发送到服务器
    await sendToServer(userMessage);
  } catch (error) {
    console.error("发送消息失败:", error);
    dom.showError("发送消息失败：" + error.message);
  } finally {
    dom.scrollToBottom();
  }
}

/**
 * 处理命令
 * @param {string} commandText 命令文本
 */
function handleCommand(commandText) {
  const args = commandText.slice(1).split(" ");
  const command = args.shift().toLowerCase();

  const showCommandResponse = (message) => {
    const $message = $(`
                <div class="message system">
                    <div class="message-content">${message}</div>
                </div>
            `);
    $("#chat-messages").append($message);
    dom.scrollToBottom();
  };

  switch (command) {
    case "help":
      showCommandResponse(`可用命令:
/clear - 清除对话历史
/help - 显示此帮助信息
/temp [0-1] - 设置 Temperature`);
      break;

    case "clear":
      chatHistory = [];
      $("#chat-messages").empty();
      showCommandResponse("已清除所有对话记录");
      saveHistory();
      break;

    case "temp":
      const temp = args[0];
      if (!temp || isNaN(temp) || temp < 0 || temp > 1) {
        showCommandResponse("请提供有效的 Temperature (0-1)");
        return;
      }
      settings_data.temperature = parseFloat(temp);
      showCommandResponse(`已设置 Temperature 为 ${settings_data.temperature}`);
      break;

    default:
      showCommandResponse(`未知命令: ${command}\n输入 /help 查看可用命令`);
  }
}

/**
 * 更新流式消息（实时显示AI回复）
 * @param {string} content 消息内容
 */
async function updateStreamingMessage(content) {
  let $messageDiv = $(".message.assistant.streaming");

  // 如果没有流式消息元素，创建一个新的
  if ($messageDiv.length === 0) {
    const message = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      isUser: false,
      role: 'assistant',
      model: currentModel,
      timestamp: new Date().toISOString(),
    };

    $messageDiv = dom.createMessageElement(message)
      .addClass("streaming")
      .append(
        '<loading><svg width="16px" height="16px" viewBox="0 0 16 16"><circle cx="8px" cy="8px" r="6px"></circle></svg></loading>'
      );

    $("#chat-messages").append($messageDiv);
  }

  // 处理内容
  try {
    const processedContent = await contentProcessor.process(content);
    const $content = $messageDiv.find(".message-content");

    // 更新内容
    $content.html(processedContent);

    // 渲染数学公式
    contentProcessor.renderMath($content[0]);

    // 高亮代码
    contentProcessor.highlightCode($content);

    // 平滑展开效果
    const currentHeight = $content[0].scrollHeight;
    $content.css("max-height", currentHeight + 50 + "px");

    dom.scrollToBottom();
  } catch (err) {
    console.error("处理消息内容失败:", err);
    const $content = $messageDiv.find(".message-content");
    $content.html(`<div class="error">渲染失败: ${err.message}</div>`);
  }
}

/**
 * 完成流式消息，转为普通消息
 * @param {string} content 消息内容
 * @param {string} replaceMessageId 要替换的消息ID（用于更新历史消息）
 */
function finalizeMessage(content, replaceMessageId) {
  let $streamingMessage = $(".message.assistant.streaming");
  if (!$streamingMessage.length) return;
  // 移除流式状态和 loading
  $streamingMessage.removeClass("streaming").find("loading").remove();

  if (replaceMessageId) {
    // 替换现有消息
    const idx = chatHistory.findIndex((m) => m.id === replaceMessageId);
    if (idx !== -1) {
      chatHistory[idx].content = content;
      // 异步更新渲染内容
      contentProcessor.process(content).then((processedContent) => {
        const $content = $streamingMessage.find(".message-content");
        $content.html(processedContent);
        $content.css("max-height", "none");
        try {
          contentProcessor.renderMath($content[0]);
          contentProcessor.highlightCode($content);
          contentProcessor.bindCodeEvents($streamingMessage);
        } catch (e) {
          console.warn("渲染增强失败:", e);
        }
        dom.bindMessageToolbarEvents($streamingMessage, chatHistory[idx]);
        saveHistory();
      });
      // 更新发送者名称
      const modelName =
        settings_data.models[chatHistory[idx].model] || chatHistory[idx].model || "AI";
      $streamingMessage.find(".message-sender").text(modelName);
      $streamingMessage.attr("data-id", replaceMessageId);
    } else {
      // 兜底：创建新消息
      handleCreateNewMessage(content, $streamingMessage);
    }
  } else {
    // 常规新消息流程
    handleCreateNewMessage(content, $streamingMessage);
  }
}

/**
 * 辅助函数：处理新消息创建
 */
function handleCreateNewMessage(content, $streamingMessage) {
  const message = createMessage(content, false);
  chatHistory.push(message);
  const $content = $streamingMessage.find(".message-content");
  contentProcessor.process(content).then((processedContent) => {
    $content.html(processedContent);
    $content.css("max-height", "none");
    contentProcessor.renderMath($content[0]);
    contentProcessor.highlightCode($content);
    dom.bindMessageToolbarEvents($streamingMessage, message);
    contentProcessor.bindCodeEvents($streamingMessage);
    $streamingMessage.find(".message-sender").text(settings_data.models[message.model] || message.model || "AI");
    $streamingMessage.attr("data-id", message.id);
    saveHistory();
  });
}

/**
 * 选择模型
 * @param {string} id 模型ID
 */
async function selectModel(id) {
  // 更新 UI 显示
  const modelName = settings_data.models[id] || id;
  $("#current-model").html(`<span class="name">${modelName}</span>`);

  // 保存到当前会话的元数据
  currentModel = id;
  localStorage.setItem("defaultModel", id);
  convManager.updateActiveMetadata({ model: id });
  dom.onConversationChanged();
}

/**
 * 保存历史到对话管理器
 */
function saveHistory() {
  // 将当前 chatHistory 写回到会话中并保存
  convManager.updateActiveMessages(chatHistory);
}

/**
 * 删除消息
 * @param {string} id 消息ID
 */
function deleteMessage(id) {
  const index = chatHistory.findIndex((msg) => msg.id === id);
  if (index !== -1) {
    chatHistory.splice(index, 1);
    $(`[data-id="${id}"]`).remove();
    saveHistory();
  }
}

/**
 * 重试消息（从该消息开始重新对话）
 * @param {string} id 消息ID
 */
async function retryMessage(id) {
  let messageIndex = chatHistory.findIndex((msg) => msg.id === id);
  if (messageIndex === -1) return;

  // 如果是AI消息，找到对应的用户消息
  if (
    chatHistory[messageIndex].role == 'assistant' &&
    messageIndex > 0
  ) {
    messageIndex--;
  }

  // 删除该消息后的所有消息
  const messages = chatHistory.slice(0, messageIndex + 1);
  console.log(messages);
  chatHistory = messages;
  await dom.renderChatHistory();
  saveHistory();

  // 重新发送
  await sendToServer(messages[messages.length - 1]);
}

// 全局当前工具调用状态
let currentToolCall = null; // { name, argsBuffer, cardElement, streamingMessageElement, originalHistory }

/**
 * 发送消息到服务器（核心通信方法）
 */
async function sendToServer() {
  dom.setLoading(true);
  let fullResponse = "";
  let buffer = "";

  try {
    // 构建消息历史（包含system prompt）
    const active = convManager.getActive();
    const systemPrompt = settings_data.systemPrompt;
    const temperature = settings_data.temperature ?? 0.7;
    const modelToUse = active?.model || currentModel;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((m) => {
        if (m.isUser) return { role: "user", content: m.content };
        if (m.role === "tool") return { role: "tool", name: m.tool, content: m.content, tool_call_id: m.tool_call_id };
        // assistant (可能包含tool_calls)
        const obj = { role: "assistant", content: m.content || "" };
        if (Array.isArray(m.tool_calls) && m.tool_calls.length) obj.tool_calls = m.tool_calls;
        return obj;
      }),
    ];

    console.log("Sending history:", messages);

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (ghtoken) headers.append("Authorization", `Bearer ${ghtoken}`);


    const response = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        model: modelToUse,
        temperature,
        tools: av_tools,
        stream: settings_data.stream ?? true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("请求达到速率上限。");
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `请求失败(${response.status})`);
    }

    const reader = response.body.getReader();
    let streamingMessageAdded = false;

    // 工具调用相关变量
    let pausedForTool = false; // 是否因工具调用暂停
    let assistantToolMessage = null; // 要求tool call的消息
    let toolCardEl = []; // 工具卡片元素
    let toolCallBuffer = []; // 工具调用列表
    let finishedToolCalls = [];

    // 匹配tool_call_id的辅助函数
    function findToolCallId(assistantMsg, toolName) {
      if (!assistantMsg || !Array.isArray(assistantMsg.tool_calls)) return undefined;
      for (const tc of assistantMsg.tool_calls) {
        if (tc.function?.name && toolName && tc.function.name.includes(toolName)) return tc.id || tc.id;
      }
      return (assistantMsg.tool_calls[0] && assistantMsg.tool_calls[0].id) || undefined;
    }

    function aNewToolCallId() {
      return 'toolcall' + Date.now() + Math.random().toString(36).substr(2, 9);
    }

    // 读取流式响应
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value);
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const ev of events) {
        if (!ev.trim()) continue;

        // 解析SSE数据
        const dataLines = ev
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.replace(/^data:\s?/, ""))
          .join("\n")
          .trim();

        if (!dataLines || dataLines === "[DONE]") continue;

        let data;
        try {
          data = JSON.parse(dataLines);
        } catch (e) {
          console.warn("Failed to parse SSE payload, skipping:", e);
          continue;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        const delta = data.choices?.[0]?.delta || {};

        // 确保有流式消息占位符
        if (delta.role === "assistant" && !streamingMessageAdded) {
          updateStreamingMessage(fullResponse);
          streamingMessageAdded = true;
        }

        // 检测工具调用
        const hasFunctionCall = !!delta.function_call;
        const hasToolCalls = Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;

        if (hasFunctionCall || hasToolCalls) {
          let toolIndex = 0;
          if (hasFunctionCall) {
            toolIndex = delta.function_call.index;
          }
          if (hasToolCalls) {
            toolIndex = delta.tool_calls[0].index;
          }
          if (toolCallBuffer.length <= toolIndex) {
            toolCallBuffer[toolIndex] = { name: "", arguments: "" };
            toolCardEl[toolIndex] = null;
            finishedToolCalls[toolIndex] = false;
          }
          // 累积工具调用参数
          if (hasFunctionCall) {
            if (delta.function_call.name) toolCallBuffer[toolIndex].name += delta.function_call.name;
            if (delta.function_call.arguments) toolCallBuffer[toolIndex].arguments += delta.function_call.arguments;
            // 转换为tool_calls格式统一处理
            delta.tool_calls = delta.tool_calls || [];
            delta.tool_calls.push({
              function: { name: delta.function_call.name || "", arguments: delta.function_call.arguments || "" },
              id: delta.function_call.id,
              index: 0,
              type: delta.function_call.type || "function",
            });
          }

          if (hasToolCalls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) toolCallBuffer[toolIndex].name += tc.function.name;
              if (tc.function?.arguments) toolCallBuffer[toolIndex].arguments += tc.function.arguments;
            }
          }

          // 创建或更新工具调用消息
          if (!assistantToolMessage) {
            assistantToolMessage = {
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              isUser: false,
              role: "assistant",
              content: fullResponse || "",
              tool_calls:
                // Array.isArray(delta.tool_calls) && delta.tool_calls.length ? JSON.parse(JSON.stringify(delta.tool_calls)) : 
                [
                  {
                    function: {
                      name: toolCallBuffer[toolIndex].name,
                      arguments: toolCallBuffer[toolIndex].arguments || ""
                    },
                    type: "function", index: toolIndex,
                    id: aNewToolCallId(),
                  },
                ],
              timestamp: new Date().toISOString(),
              model: currentModel,
            };

            chatHistory.push(assistantToolMessage);
            saveHistory();
            const $rendered = await dom.renderMessageElement(assistantToolMessage);
            const $streaming = $(".message.assistant.streaming");
            if ($streaming.length) {
              $streaming.replaceWith($rendered);
            } else {
              $("#chat-messages").append($rendered);
            }
          } else {

            if (!assistantToolMessage.tool_calls[toolIndex]) {
              assistantToolMessage.tool_calls[toolIndex] = {
                id: aNewToolCallId(),
                function: { name: toolCallBuffer[toolIndex].name, arguments: toolCallBuffer[toolIndex].arguments || "" },
                type: "function",
                index: toolIndex,
              };
            }
            // 更新现有工具调用参数
            assistantToolMessage.tool_calls = assistantToolMessage.tool_calls || [];
            assistantToolMessage.tool_calls[toolIndex] = assistantToolMessage.tool_calls[toolIndex] || { function: { name: "", arguments: "" } };
            assistantToolMessage.tool_calls[toolIndex].function.arguments = toolCallBuffer[toolIndex].arguments;
            saveHistory();
          }

          // 确保有流式消息占位符用于后续内容
          // if (!streamingMessageAdded) {
          //   updateStreamingMessage(fullResponse);
          //   streamingMessageAdded = true;
          // } else {
          //   updateStreamingMessage(fullResponse);
          // }

          // 显示工具卡片（只创建一次）
          if (!toolCardEl[toolIndex]) {
            let result = "";
            toolCardEl[toolIndex] = dom.createToolCard({
              name: toolCallBuffer[toolIndex].name,
              argsText: toolCallBuffer[toolIndex].arguments,
              beforeEl: $(`.message.assistant.streaming`),
              onApprove: async ($card) => {
                dom.updateToolCardState($card, "loading");
                let parsedArgs;
                try {
                  parsedArgs = JSON.parse(toolCallBuffer[toolIndex].arguments);
                } catch {
                  parsedArgs = toolCallBuffer[toolIndex].arguments;
                }
                const handler = tool_handlers[toolCallBuffer[toolIndex].name];
                try {
                  if (handler) result = await handler(parsedArgs);
                  else result = `[找不到工具: ${toolCallBuffer[toolIndex].name}]`;
                  if(typeof result !== "string") {
                    result = JSON.stringify(result, null, 2);
                  }
                  if (result.length > 1000) {
                    result = result.substring(0, 1000) + "......[结果过长，已截断]";
                  }
                  console.log("Name:", toolCallBuffer[toolIndex].name, "Args:", parsedArgs, "Result:", result);

                } catch (err) {
                  console.error("Tool execution failed:", err);
                  result = `工具执行失败: ${err.message || err}`;
                }
                const toolMessage = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  content: result,
                  isUser: false,
                  role: "tool",
                  tool: toolCallBuffer[toolIndex].name,
                  tool_call_id: assistantToolMessage.tool_calls[toolIndex].id,
                  timestamp: new Date().toISOString(),
                };
                chatHistory.push(toolMessage);
                saveHistory();

                dom.renderMessageElement(toolMessage).then(($tm) => {
                  $card.after($tm);
                  dom.updateToolCardResultWithDone($card, result);
                  dom.scrollToBottom();
                });
                finishedToolCalls[toolIndex] = true;
                console.log("Finished tool calls:", finishedToolCalls);
                if (finishedToolCalls.indexOf(false) === -1) {
                  pausedForTool = false;
                  await continueAfterTool();
                }
              },
              onDeny: async ($card) => {
                if (assistantToolMessage) {
                  assistantToolMessage.content = fullResponse;
                }

                const toolMessage = {
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  content: '[用户已拒绝]',
                  isUser: false,
                  role: "tool",
                  tool: toolCallBuffer[toolIndex].name,
                  tool_call_id: assistantToolMessage.tool_calls[toolIndex].id,
                  timestamp: new Date().toISOString(),
                };
                chatHistory.push(toolMessage);
                saveHistory();
                finishedToolCalls[toolIndex] = true;

                dom.renderMessageElement(toolMessage).then(($tm) => {
                  $card.after($tm);
                  dom.updateToolCardResultWithDone($card, "[用户已拒绝]");
                  dom.scrollToBottom();
                });
                if (finishedToolCalls.indexOf(false) === -1) {
                  pausedForTool = false;
                  await continueAfterTool();
                }
                // finalizeMessage(fullResponse, assistantToolMessage ? assistantToolMessage.id : undefined);
                // pausedForTool = false;
              },
            });
          } else {
            dom.updateToolCardPreview(toolCardEl[toolIndex], toolCallBuffer[toolIndex].arguments);
            if (assistantToolMessage) {
              assistantToolMessage.tool_calls[toolIndex].function.arguments = toolCallBuffer[toolIndex].arguments;
              saveHistory();
            }
          }

          // 如果服务器标记tool_calls完成，暂停读取
          if (data.choices?.[0]?.finish_reason === "tool_calls") {
            try {
              await reader.cancel();
            } catch (e) { }
            pausedForTool = true;
            break;
          }

          continue;
        }

        // 普通文本内容
        const text = delta.content || "";
        if (text) {
          fullResponse += text;
          if (!streamingMessageAdded) {
            updateStreamingMessage(fullResponse);
            streamingMessageAdded = true;
          } else {
            updateStreamingMessage(fullResponse);
          }
        }
      }

      if (pausedForTool) break;
    }

    // 处理剩余的缓冲区数据
    if (buffer.trim()) {
      try {
        const lines = buffer.split("\n").filter((l) => l.startsWith("data:"));
        const dataStr = lines.map((l) => l.replace(/^data:\s?/, "")).join("\n").trim();
        if (dataStr && dataStr !== "[DONE]") {
          const data = JSON.parse(dataStr);
          const content = data.choices?.[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            updateStreamingMessage(fullResponse);
          }
        }
      } catch (e) {
        console.error("Failed to process final buffer:", e);
      }
    }
    // 完成消息
    if (fullResponse) finalizeMessage(fullResponse);
  } catch (error) {
    console.error("请求失败", error);
    dom.showError(error.message || "服务器连接失败，请稍后重试");
  } finally {
    dom.setLoading(false);
  }

  /**
   * 工具调用后继续对话
   */
  async function continueAfterTool() {
    finalizeMessage(fullResponse);
    fullResponse = '';
    sendToServer();
    return;
    dom.setLoading(true);
    let contFullResponse = ''; // 续写到原有内容上
    try {
      const active = convManager.getActive();
      const systemPrompt = settings_data.systemPrompt;
      const temperature = settings_data.temperature ?? 0.7;
      const modelToUse = active?.model || currentModel;

      // 使用当前chatHistory构造消息（包含工具调用和结果）
      const messages2 = [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((msg) => {
          if (msg.isUser) return { role: "user", content: msg.content };
          if (msg.role === "tool"){
            console.log("Mapping tool message:", msg);
            return { role: "tool", name: msg.tool, content: msg.content, tool_call_id: msg.tool_call_id };
          }
          // assistant（可能包含tool_calls）
          const assistantObj = { role: "assistant", content: msg.content || "" };
          if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
            assistantObj.tool_calls = msg.tool_calls.map((tc) => ({
              ...tc,
              type: tc.type || "function",
              function: {
                name: (tc.function && tc.function.name) || "",
                arguments: (tc.function && tc.function.arguments) || "",
              },
            }));
          }
          return assistantObj;
        }),
      ];

      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      if (ghtoken) {
        headers.append("Authorization", `Bearer ${ghtoken}`);
      }

      const response = await fetch(`${ENDPOINT}/chat/completions`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          messages: messages2,
          model: modelToUse,
          temperature: temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `请求失败 ${response.status}`);
      }

      const reader = response.body.getReader();
      let buffer2 = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer2 += new TextDecoder().decode(value);

        const events2 = buffer2.split("\n\n");
        buffer2 = events2.pop() || "";

        for (const ev2 of events2) {
          if (!ev2.trim()) continue;
          const dataLines2 = ev2
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.replace(/^data:\s?/, ""))
            .join("\n")
            .trim();

          if (!dataLines2 || dataLines2 === "[DONE]") continue;
          try {
            const data = JSON.parse(dataLines2);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              contFullResponse += content;
              // 继续更新原来的流式消息内容
              updateStreamingMessage(contFullResponse);
            }
          } catch (e) {
            console.warn("skip:", e, dataLines2);
            continue;
          }
        }
      }

      // 处理最后缓冲
      if (buffer2.trim()) {
        try {
          const lines = buffer2.split("\n").filter((l) => l.startsWith("data:"));
          const dataStr = lines.map((l) => l.replace(/^data:\s?/, "")).join("\n").trim();
          if (dataStr && dataStr !== "[DONE]") {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) {
              contFullResponse += content;
              updateStreamingMessage(contFullResponse);
            }
          }
        } catch (e) {
          console.error("处理最后缓冲区失败:", e);
        }
      }

      // 将结果写回到原始assistant消息
      fullResponse = contFullResponse;
      // 将后续回复作为新的assistant消息
      if (fullResponse) finalizeMessage(fullResponse);
    } catch (err) {
      console.error("继续请求失败:", err);
      dom.showError("工具后续请求失败：" + (err.message || err));
    } finally {
      dom.setLoading(false);
    }
  }
}