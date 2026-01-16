const ENDPOINT = "https://models.github.ai/inference";

const GITHUB_TOKEN = "__your_gh_token__";
// 你的 token，确保有 AI 模型的 read 权限，也可以在设置中填写

const DEFAULT_MODEL = "openai/gpt-4.1";

const DEFAULT_SETTINGS = {
  systemPrompt:
    `你是一个桌面 AI 助手，帮助用户处理事务、回答用户问题等。
除了特殊情况外，请尽量缩减回答的长度，精简内容，避免过多不必要的描述。请和用户人性化地交流。

在用户要求帮助完成操作任务时，请使用提供的工具。你可以一次调用多个工具。
为了用户体验，在要求明确的情况下，请直接调用工具，不必确认询问。如果要运行极高风险的指令，则要在调用的同时，向用户说明解释。
在调用工具时，系统会向用户确认，因此你不必询问用户。

在回答内容中，如果需要，你可以使用标准的 Markdown 格式。数学公式可以使用$和$$包裹。示意图可以用 Mermaid 代码块编写。显示矢量图，可用 svg 代码块编写。`,
  temperature: 0.7,
  stream: true,
  autoTheme: true, // 是否跟随系统主题
  theme: null, // 可保存手动选择 "light" 或 "dark"，null 表示使用系统/auto
  models: {
    "microsoft/MAI-DS-R1": "MAI DS R1",
    "deepseek/DeepSeek-V3-0324": "DS V3",
    "deepseek/DeepSeek-R1": "DS R1",
    "openai/gpt-4.1": "GPT 4.1",
    "openai/gpt-4.1-nano": "GPT 4.1 nano",
    "openai/gpt-4.1-mini": "GPT 4.1 mini",
    "openai/gpt-4o": "GPT 4o",
    "openai/gpt-4o-mini": "GPT 4o mini",
    "meta/Llama-4-Scout-17B-16E-Instruct": "Llama 4 Scout",
    "meta/Llama-4-Maverick-17B-128E-Instruct-FP8": "Llama 4 Maverick",
  }, // 初始可编辑模型列表（设置中可修改，会保存至 localStorage）
};
