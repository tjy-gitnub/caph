const dom = new Dom();

chatHistory = []; // 当前对话消息历史
isProcessing = false; // 消息处理状态标志
pausingForToolCall = false; // 是否在等待工具调用用户确认
editingMessageId = null; // 正在编辑的消息ID
abortController = null; // 用于取消请求的 AbortController

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

// 确定当前使用的模型（优先级：当前会话 > 本地存储 > 设置 > 默认）
const activeConv = convManager.getActive();
defaultModel =
  activeConv?.model ||
  localStorage.getItem("defaultModel") ||
  DEFAULT_MODEL;
currentModel =
  activeConv?.model || localStorage.getItem("defaultModel") || defaultModel;

// 处理 GitHub Token
if (GITHUB_TOKEN !== "__your_gh_token__") {
  ghtoken = GITHUB_TOKEN;
  $("#token-error").hide();
} else {
  ghtoken = localStorage.getItem("ghtoken");
  if (!ghtoken) {
    console.error("未设置 GITHUB_TOKEN。请前往设置页面输入你的 GitHub Token。");
    document.addEventListener("DOMContentLoaded", () => {
      $("#token-error").show();
    });
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
  if (abortController) {
    abortController.abort();
    abortController = null;
    return;
  }
  if (pausingForToolCall) return;
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

function showCommandResponse(message) {
  const $message = $(`
                <div class="message system">
                    <div class="message-content">${message}</div>
                </div>
            `);
  $("#chat-messages").append($message);
  dom.scrollToBottom();
};

/**
 * 处理命令
 * @param {string} commandText 命令文本
 */
function handleCommand(commandText) {
  const args = commandText.slice(1).split(" ");
  const command = args.shift().toLowerCase();

  switch (command) {
    case "help":
      showCommandResponse(`可用命令:
/guide - 使用指南
/clear - 清除对话历史
/temp [0-1] - 设置 Temperature
/help - 显示此帮助信息`);
      break;

    case "guide":
      window.cefBridge.openGuide();
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

    contentProcessor.renderMath($content[0]);
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
  let index = chatHistory.findIndex((msg) => msg.id === id);
  if (index !== -1) {
    if (chatHistory[index].role == 'assistant') {
      chatHistory.splice(index, 1);
      // $(`[data-id="${id}"]`).remove();
      index--;
      while (index > 0 && (chatHistory[index].role === 'tool' || chatHistory[index].role === 'assistant')) {
        chatHistory.splice(index, 1);
        index--;
      }
    } else {
      chatHistory.splice(index, 1);
    }
    saveHistory();
    dom.renderChatHistory();
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
    const enableTool = localStorage.getItem("enableTool") === "true";
    const systemPrompt = settings_data.simplePrompt + (enableTool ? '\n\n' + settings_data.toolCallPrompt + '\n\n默认的工作目录在用户的 Documents 文件夹。越出当前工作目录的操作都会被阻止，如果你要操作其它位置，必须先用change_directory工具切换工作目录。' : '');
    const temperature = settings_data.temperature ?? 0.7;
    const modelToUse = active?.model || currentModel;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((m) => {
        if (m.isUser) return { role: "user", content: m.content };
        if (m.role === "system") return { role: "system", content: m.content };
        if (m.role === "tool") return { role: "tool", name: m.tool, content: m.content, tool_call_id: m.tool_call_id };
        // assistant (可能包含tool_calls)
        const obj = { role: "assistant", content: m.content || "" };
        if (Array.isArray(m.tool_calls) && m.tool_calls.length) obj.tool_calls = m.tool_calls;
        return obj;
      }),
    ];

    console.log("Sending request with history:", messages);

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (ghtoken) headers.append("Authorization", `Bearer ${ghtoken}`);
    else {
      throw new Error("未设置 GitHub Token。请前往设置页面输入你的 GitHub Token。");
    }

    const enabledTools = av_tools.filter(t => {
      return !settings_data.tools_disabled[t.function.name];
    });
    let req_body = {
      messages,
      model: modelToUse,
      temperature,
      stream: settings_data.stream ?? true,
    };
    if (enableTool && enabledTools.length > 0) {
      req_body.tools = enabledTools;
    }
    abortController = new AbortController();
    const response = await fetch(`${ENDPOINT}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(req_body),
      signal: abortController.signal,
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("请求达到速率上限。");
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `请求失败(${response.status})`);
    }

    const reader = response.body.getReader();
    let streamingMessageAdded = false;

    // 工具调用相关变量
    let assistantToolMessage = null; // 要求tool call的消息
    let toolCardEl = []; // 工具卡片元素
    let toolCallBuffer = []; // 工具调用列表
    let finishedToolCalls = [];
    let anyApproved = false;

    function aNewToolCallId() {
      return 'toolcall' + Date.now() + Math.random().toString(36).substr(2, 9);
    }

    // 读取流式响应
    while (true) {
      const { value, done } = await reader.read();


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

            toolCallBuffer[toolIndex].onApprove = async ($card) => {
              dom.updateToolCardState($card, "loading");
              let result = "";

              const parsedArgs = JSON.parse(toolCallBuffer[toolIndex].arguments);
              const handler = tool_handlers[toolCallBuffer[toolIndex].name];
              let cwdChanged = false, cwd_now;
              try {
                if (handler) result = await handler(parsedArgs);
                else result = `[找不到工具: ${toolCallBuffer[toolIndex].name}]`;
                if (toolCallBuffer[toolIndex].name === 'change_directory') {
                  if (result.status === 'success') {
                    cwdChanged = true;
                    cwd_now = result.cwd;
                    result = `当前工作目录为 ${result.cwd}`;
                    $('#current-cwd').text(convManager.getcwd() || '文档');
                  } else {
                    result = result.message;
                  }
                }
                if (typeof result !== "string") {
                  result = JSON.stringify(result, null, 2);
                }
                if (result.length > 3000) {
                  result = result.substring(0, 3000) + "......[结果过长，已截断]";
                }
                console.log("Tool name:", toolCallBuffer[toolIndex].name, "Args:", parsedArgs, "Result:", result);

              } catch (err) {
                console.error("Tool failed:", err);
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
                description: toolCallBuffer[toolIndex].description,
                // 在响应结束后生成
              };
              if (cwdChanged) {
                toolMessage.cwd = cwd_now;
              }
              chatHistory.push(toolMessage);
              saveHistory();

              dom.renderMessageElement(toolMessage).then(($tm) => {
                $card.after($tm);
                dom.updateToolCardResultWithDone($card);
                dom.scrollToBottom();
              });
              finishedToolCalls[toolIndex] = true;
              anyApproved = true;
              if (finishedToolCalls.indexOf(false) === -1) {
                continueAfterTool();
              }
            };
            toolCallBuffer[toolIndex].onDeny = ($card) => {
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
                description: toolCallBuffer[toolIndex].description
                // 在响应结束后生成
              };
              chatHistory.push(toolMessage);
              saveHistory();
              finishedToolCalls[toolIndex] = true;

              dom.renderMessageElement(toolMessage).then(($tm) => {
                $card.after($tm);
                dom.updateToolCardResultWithDone($card);
                dom.scrollToBottom();
              });
              if (finishedToolCalls.indexOf(false) === -1) {
                if (anyApproved) {
                  continueAfterTool();
                } else {
                  pausingForToolCall = false;
                  $('#send-button,#toggle-tool').prop('disabled', false);
                  dom.setLoading(false);
                }
              }
            };

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
              tool_calls: [
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
            } else {
              assistantToolMessage.tool_calls[toolIndex].function.name = toolCallBuffer[toolIndex].name;
              assistantToolMessage.tool_calls[toolIndex].function.arguments = toolCallBuffer[toolIndex].arguments;
            }
            saveHistory();
          }

          // 显示工具卡片（只创建一次）
          if (!toolCardEl[toolIndex]) {
            toolCardEl[toolIndex] = dom.createToolCard(toolCallBuffer[toolIndex]);
          } else {
            dom.updateToolCardPreview(toolCardEl[toolIndex], toolCallBuffer[toolIndex]);
            // if (assistantToolMessage) {
            //   assistantToolMessage.tool_calls[toolIndex].function.arguments = toolCallBuffer[toolIndex].arguments;
            //   saveHistory();
            // }
          }

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

      if (done) {
        console.log("Stream ended");
        if (toolCallBuffer.length > 0) {
          console.log("Pausing for", toolCallBuffer.length, "tool calls");
          dom.pauseForToolCall(toolCardEl);
          // 生成描述
          for (let i = 0; i < toolCallBuffer.length; i++) {
            const describer = tool_describers[toolCallBuffer[i].name];
            toolCallBuffer[i].description = describer ?
              describer(JSON.parse(toolCallBuffer[i].arguments)) :
              `<p>${toolCallBuffer[i].name}：${toolCallBuffer[i].arguments}</p>`;
            toolCardEl[i].find(".message-content").html(toolCallBuffer[i].description);
          }
          if (toolCallBuffer.length > 1) {
            // 整理多个工具卡片
            dom.arrangeMultipleToolCards(toolCallBuffer, toolCardEl, finishedToolCalls);
          }
        }
        break;
      }
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
    if (error.name === 'AbortError') {
      if (fullResponse) {
        finalizeMessage(fullResponse + '\n[已终止]');
      }
    } else {
      console.error("请求失败", error);
      dom.showError(error.message || "请求失败");
    }
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
  }
}

function opendevtools() {
  if (localStorage.getItem('opendevtools') == 'true') {
    if (window.cefBridge) {
      window.cefBridge.openDevTools();
    }
    return;
  }
  $('#devtools-confirm').fadeIn(100);
  $('#app,#settings-modal').removeClass('show');
}