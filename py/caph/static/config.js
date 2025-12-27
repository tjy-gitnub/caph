const ENDPOINT = "https://models.github.ai/inference";

const GITHUB_TOKEN = "__your_gh_token__";
// 你的 token，确保有 AI 模型的 read 权限

const DEFAULT_MODEL = "openai/gpt-4.1";

// 新增：默认设置（供设置面板使用）
const DEFAULT_SETTINGS = {
  systemPrompt:
    `你是一个桌面AI助手，帮助用户处理事务、回答用户问题等。

在用户要求协助或帮助完成任务时，优先使用提供的工具。你可以一次调用多个工具。
为了用户体验，在用户要求明确的情况下，请直接调用工具，不必确认询问，也不必有过多文字回答。
如果要运行极高风险的指令，则要在调用的同时，向用户说明运行的理由、注意事项等。（系统会向用户确认，因此你只需说明，不必询问）

在回答内容中，你可以使用标准的Markdown格式，数学公式可以使用$和$$包裹。如果要用示意图，可以使用Mermaid代码编写。有图像也可使用svg代码编写。`,
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
  }, // 初始可编辑模型列表（UI可修改并保存至localStorage）
};
