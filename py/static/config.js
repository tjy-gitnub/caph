// 工具调用返回结果的最大长度，超过则截断
const MAX_TOOL_RESULT_LENGTH = 3000;

const DEFAULT_SETTINGS = {
  simplePrompt:
    `你是一个桌面 AI 助手，帮助用户处理事务、回答用户问题等。
除了特殊情况外，请尽量缩减回答的长度，精简内容，避免过多不必要的描述。请和用户人性化地交流。

在回答内容中，如果需要，你可以使用标准的 Markdown 格式。数学公式可以使用$和$$包裹。示意图可以用 Mermaid 代码块编写。显示矢量图，可用 svg 代码块编写。`,
  toolCallPrompt:
    `在用户要求帮助完成操作任务时，请使用提供的工具。你可以一次调用多个工具。
为了用户体验，在要求明确的情况下，请直接调用工具，不必确认询问。如果要运行极高风险的指令，则要在调用的同时，向用户说明解释。
在调用工具前，系统会询问用户同意，因此你不必询问用户。用户可能拒绝。`,
  temperature: 0.7,
  stream: true,
  autoTheme: true,
  theme: null,

  // modelList: 每个模型包含 id(api识别标识)、name(显示名)、provider(服务商标识)、pid(程序内部数字ID)
  modelList: [
    { "id": "openai/gpt-4.1", "name": "GPT 4.1", "provider": "github", "pid": 1 },
    { "id": "openai/gpt-4o", "name": "GPT 4o", "provider": "github", "pid": 2 },
    { "id": "openai/gpt-4o-mini", "name": "GPT 4o mini", "provider": "github", "pid": 3 },
    { "id": "openai/gpt-4.1-mini", "name": "GPT 4.1 mini", "provider": "github", "pid": 4 },
    { "id": "openai/gpt-4.1-nano", "name": "GPT 4.1 nano", "provider": "github", "pid": 5 },
    { "id": "deepseek/DeepSeek-R1", "name": "DS R1", "provider": "github", "pid": 6 },
    { "id": "deepseek/DeepSeek-V3-0324", "name": "DS V3", "provider": "github", "pid": 7 },
    { "id": "microsoft/MAI-DS-R1", "name": "MAI DS R1", "provider": "github", "pid": 8 },
    { "id": "meta/Llama-4-Scout-17B-16E-Instruct", "name": "Llama 4 Scout", "provider": "github", "pid": 9 },
    { "id": "meta/Llama-4-Maverick-17B-128E-Instruct-FP8", "name": "Llama 4 Maverick", "provider": "github", "pid": 10 }
  ],

  // providers 列表：name(程序内显示名)、key(程序内标识)、api_endpoint、request_type、api_key(默认空)
  providers: [
    {
      name: "GitHub Models",
      key: "github",
      api_endpoint: "https://models.github.ai/inference/chat/completions",
      request_type: "openai_compatible",
      api_key: ""
    },
    {
      name: "OpenAI",
      key: "openai",
      api_endpoint: "https://api.openai.com/v1/chat/completions",
      request_type: "openai_compatible",
      api_key: ""
    },
    {
      name: "千问",
      key: "qwen",
      api_endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      request_type: "openai_compatible",
      api_key: ""
    },
    // ollama 不允许从网页访问
    // {
    //   name: "Ollama",
    //   key: "ollama",
    //   api_endpoint: "http://localhost:11434/v1/chat/completions",
    //   request_type: "openai_compatible",
    //   api_key: "{null}"
    // },
    {
      name: "Claude",
      key: "claude",
      api_endpoint: "https://api.anthropic.com/v1/messages",
      request_type: "openai_compatible",
      api_key: ""
    },
  ],
};

// 新增：配置工具函数，供运行时查找模型/服务商并生成请求信息
window.configUtils = {
  // 在 settings_data.modelList 中查找模型（按 pid 或 id）
  findModelByPid(pid) {
    if (!window.settings_data || !Array.isArray(window.settings_data.modelList)) return null;
    return window.settings_data.modelList.find(m => Number(m.pid) === Number(pid)) || null;
  },
  findGithubModelById(id) {
    if (!window.settings_data || !Array.isArray(window.settings_data.modelList)) return null;
    return window.settings_data.modelList.find(m => m.provider === 'github' && m.id === id) || null;
  },
  // 查找 provider 信息
  getProviderByKey(key) {
    if (!window.settings_data || !Array.isArray(window.settings_data.providers)) return null;
    return window.settings_data.providers.find(p => p.key === key) || null;
  },
  // 根据 provider 构造完整 endpoint（返回 {url, init}）
  // 支持 request_type: "openai_compatible" -> POST { model, messages, temperature, stream, tools? }
  // 其它类型保留基础框架以便后续扩展
  buildRequestForProvider(provider, reqBody) {
    if (!provider) throw new Error("Missing provider");
    const baseUrl = provider.api_endpoint;
    const headers = { "Content-Type": "application/json" };
    // 仅使用 provider 内配置的 api_key（用户在“服务商”中填写）
    const key = provider.api_key || null;
    if (key && key !== "{null}") headers["Authorization"] = `Bearer ${key}`;

    if (provider.request_type === "openai_compatible") {
      const init = {
        method: "POST",
        headers,
        body: JSON.stringify(reqBody),
      };
      return { url: baseUrl, init };
    }

    // 默认回退：把整个 reqBody 放到 body 字段，POST 到 api_endpoint
    return {
      url: baseUrl,
      init: {
        method: "POST",
        headers,
        body: JSON.stringify(reqBody),
      },
    };
  }
};
