window.GUIDE_DATA = {
  "files": [
    {
      "name": "welcome",
      "title": "欢迎",
      "path": "welcome.md",
      "html": "<h1>欢迎使用 Caph !</h1>\n\n<p>以下是常见的一些问题：</p>\n\n<ul>\n<li>Github token 是什么？我要如何得到它？<a href=\"#\" data-mdpath=\"settings/1token.md\">&gt;&gt; token相关</a></li>\n<li>怎么添加更多 AI 模型？怎么修改模型？<a href=\"#\" data-mdpath=\"settings/2models.md\">&gt;&gt; 模型管理</a></li>\n<li>怎么添加其它平台的 AI？<a href=\"#\" data-mdpath=\"settings/3provider.md\">&gt;&gt; 服务商</a></li>\n</ul>\n"
    }
  ],
  "children": [
    {
      "info": {
        "name": "设置相关"
      },
      "path": "settings",
      "files": [
        {
          "name": "1token",
          "title": "Github Token",
          "path": "settings/1token.md",
          "html": "<h1>Github Token</h1>\n\n<h2>什么是 Github Token？</h2>\n\n<p>通俗地讲， Github Token 能用于身份验证。功能类似于你的账号+密码。</p>\n\n<h2>如何获取</h2>\n\n<ol>\n<li><p>首先，确保你有 Github 账号。</p>\n\n<blockquote>\n  <p>若还没有，于 <a href=\"https://github.com/signup\">此处注册</a>。</p>\n  \n  <p>Github 网站在某些偏远地区访问困难，若遇到访问时间过长，建议使用 VPN 加速。</p>\n</blockquote></li>\n<li><p>前往 <a href=\"https://github.com/settings/personal-access-tokens/new?description=%E7%94%A8%E4%BA%8E%E4%BD%BF%E7%94%A8%20Caph%20%28https%3A%2F%2Fgithub.com%2Ftjy-gitnub%2Fcaph%29&name=GitHub+Models+token+for+Caph&user_models=read\">此处申请 token</a> 。</p>\n\n<blockquote>\n  <p>Caph 不会读取你的其它信息。不过，为安全计，你也可以在\"Repository access\"中选择 &#8220;Only select repositories\"，然后不选择任何仓库。</p>\n</blockquote></li>\n<li><p>点击 <code>Generate token</code> 按钮。</p></li>\n<li><p>复制生成的 token，在 Caph 中填写。</p>\n\n<blockquote>\n  <p>务必妥善保存 token。若丢失，需重新生成，并注意删除之前申请的权限。</p>\n</blockquote></li>\n</ol>\n\n<h2>关于付费</h2>\n\n<p>Caph 内自带的模型均免费。你可以在 <a href=\"https://docs.github.com/zh/github-models/use-github-models/prototyping-with-ai-models#rate-limits\">此处查看模型的免费额度、速率限制</a>。</p>\n\n<p>不过，你同样可以选择购买 Copilot Pro 或商业版，来使用 gpt5 等高级模型。你需要在 Caph 的 <a href=\"#\" data-mdpath=\"settings/2models.md\">设置中添加模型</a>。</p>\n"
        },
        {
          "name": "2models",
          "title": "管理模型",
          "path": "settings/2models.md",
          "html": "<h1>管理模型</h1>\n\n<p>在 <strong>设置</strong> 的 <strong>管理模型</strong> 页面，你可以对模型列表进行添加、修改、调整顺序和删除。</p>\n\n<h2>操作</h2>\n\n<ul>\n<li><p>添加新模型</p>\n\n<p>点击页面最底部 <code>添加新模型</code> 按钮，填写内容即可。注意保存。填写的内容可参见下文 <strong>模型信息</strong>。</p></li>\n<li><p>调整顺序</p>\n\n<p>你可以通过拖拽模型来调整它们在模型列表中的顺序。</p></li>\n<li><p>修改模型</p>\n\n<p>直接编辑文本框内容。</p></li>\n<li><p>删除模型</p>\n\n<p>展开模型卡片，点击底部按钮，即可删除。</p></li>\n</ul>\n\n<h2>模型信息</h2>\n\n<p>如你所见，每个模型卡片中有 <code>显示名称</code>、<code>服务商</code> 和 <code>API 标识</code>。</p>\n\n<p><strong>显示名称：</strong> 即在模型列表中显示的名字，依你喜好而定，你认得就行。</p>\n\n<p><strong>服务商：</strong> 即提供 AI 对话服务的平台。详见<a href=\"#\" data-mdpath=\"settings/3provider.md\">服务商</a></p>\n\n<p><strong>API 标识：</strong> 服务商命名的 id。对应了一个特定的 AI 模型。你需要在服务商的提供的信息中寻找。对于 Github Models，获取步骤如下：</p>\n\n<ol>\n<li><p>在 Gtihub 的 <a href=\"https://github.com/marketplace?task=chat-completion&type=models\">Models 页面</a> 里浏览并选择一个 AI 模型。</p></li>\n<li><p>进入模型的详细页面，点击右上角的 <code>Use this model (使用该模型)</code>。</p></li>\n<li>点击左侧 <code>Chapters (章节)</code> 栏的 <code>3. Run a basic code sample (基本代码示例)</code>。</li>\n<li><p>在代码示例开头，找到 <code>model</code> 字符串的值，即为模型 ID。</p>\n\n<blockquote>\n  <p>即形如 <code>model = \"openai/gpt-4o-mini\"</code> 中，引号之内的部分（<code>openai/gpt-4o-mini</code>）</p>\n</blockquote></li>\n</ol>\n"
        },
        {
          "name": "3provider",
          "title": "服务商",
          "path": "settings/3provider.md",
          "html": "<h1>服务商</h1>\n\n<p>在 <strong>设置</strong> 的 <strong>服务商</strong> 页面，你可以对提供 AI 的服务商的进行添加、修改。</p>\n\n<h2>操作</h2>\n\n<ul>\n<li><p>修改服务商信息</p>\n\n<p>直接编辑文本框内容。请谨慎编辑。</p></li>\n<li><p>添加服务商</p>\n\n<p>你可能需要自行研究。你需要阅读平台提供的相关文档，确定服务提供的节点等信息。你当然可以在网上搜索相关信息。</p></li>\n</ul>\n\n<blockquote>\n  <p>目前，Caph 仅支持 OpenAI API 格式兼容的模型平台。（目前大多数平台都是此类）</p>\n  \n  <p>然而，<strong>Gemini</strong> 目前尚不兼容。</p>\n  \n  <p>另外，如果你要添加 <strong>本地 Ollama</strong> 的模型，可能需要进行一些配置。<a href=\"https://github.com/ollama/ollama/issues/2335\">详见此</a></p>\n</blockquote>\n"
        }
      ],
      "children": []
    }
  ]
};