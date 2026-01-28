<!-- name=Github Token -->
# Github Token

## 什么是 Github Token？
通俗地讲， Github Token 能用于身份验证。功能类似于你的账号+密码。

## 如何获取
1. 首先，确保你有 Github 账号。
    > 若还没有，于 [此处注册](https://github.com/signup)。
    > 
    > Github 网站在某些偏远地区访问困难，若遇到访问时间过长，建议使用 VPN 加速。

2. 前往 [此处申请 token](https://github.com/settings/personal-access-tokens/new?description=%E7%94%A8%E4%BA%8E%E4%BD%BF%E7%94%A8%20Caph%20%28https%3A%2F%2Fgithub.com%2Ftjy-gitnub%2Fcaph%29&name=GitHub+Models+token+for+Caph&user_models=read) 。
    > Caph 不会读取你的其它信息。不过，为安全计，你也可以在"Repository access"中选择 "Only select repositories"，然后不选择任何仓库。

3. 点击 `Generate token` 按钮。

4. 复制生成的 token，在 Caph 中填写。
    > 务必妥善保存 token。若丢失，需重新生成，并注意删除之前申请的权限。

## 关于付费

Caph 内自带的模型均免费。你可以在 [此处查看模型的免费额度、速率限制](https://docs.github.com/zh/github-models/use-github-models/prototyping-with-ai-models#rate-limits)。

不过，你同样可以选择购买 Copilot Pro 或商业版，来使用 gpt5 等高级模型。你需要在 Caph 的 [设置中添加模型](./2models.md)。