# dsh-iui

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的智能界面（Intelligent UI）插件。模型回答时，可以额外给出结构化的内容块（content block），插件把它们渲染成回复下方的交互卡片。每个内容块具体用哪种组件展示，由规则决定；配置了 [TypeSafe Jev](https://typesafe.ai) 后改由 Jev 决定。

这是一个纯插件，不修改 DSH 源码。

## 工作方式

1. **模型给出语义内容。** 模型调用 `render_ui`，给出 summary、comparison、calculator、calendar 等内容块，只描述内容，不描述布局。字段说明由 `ui_reference` 工具按需提供，所以常驻系统提示只有几句话。
2. **宿主校验。** 插件按字段 schema 和跨字段规则校验每个内容块，例如对比项要覆盖全部属性、公式只能引用输入项、日期必须是真实存在的日期。不通过时，带路径的错误信息返回给模型，由模型修正后重试。
3. **决定组件。** 每个内容块都有若干候选组件，例如 chart 可以是 bar、line、area 或 scatter。配置了 Jev 时由 Jev 选择；Jev 不可用或置信度不足时，由规则选择。
4. **在沙箱中渲染。** 卡片在 `sandbox="allow-scripts"` 的 iframe 中用 React 19 和 [Astryx](https://github.com/meta/astryx) 渲染，iframe 的 CSP 禁止一切网络请求。点击链接时由外层页面在新标签页打开，只允许 http/https 地址。卡片上的交互状态（选项、输入值、勾选、日期）按会话保存在浏览器本地。

## 内容块

共 25 类内容块、57 个组件变体：

| 内容块 | 候选组件 |
|---|---|
| summary | callout、card |
| notice | banner、inline |
| comparison | table、card-grid |
| choice | segmented、option-cards、radio-list |
| calculator | sliders、number-fields |
| steps | stepper、numbered-list、accordion |
| metrics | stat-cards、metadata、progress |
| checklist | checkbox-list、cards |
| faq | accordion、list |
| sections | tabs、radio-list、accordion |
| chart | bar、line、area、scatter |
| code | code-block、numbered |
| quote | blockquote、card |
| tags | tokens、badges |
| text | markdown、compact |
| timeline | vertical-steps、dated-list |
| tree | tree、nested-list |
| gallery | carousel、grid |
| glossary | metadata、infotips、list |
| shortcuts | table、list |
| sources | citations、links |
| status | dots、badges |
| timer | countdown、stopwatch |
| people | list、cards |
| calendar | calendar、agenda |

## 安装

需要 Node.js 24.9 或更高版本，以及 DSH 0.2.2 或更高版本。

```sh
dsh plugin --profile <profile> add @zengwenliang416/dsh-iui
dsh <profile>
```

插件的 `cordis.patch.yml` 会在 profile 根部插入 `dsh-iui`，`render_ui` 和 `ui_reference` 随之进入全局工具层。

## 配置

不配置也可以使用，此时由规则决定组件。启用 Jev 时，先设置环境变量 `TYPESAFE_API_KEY`，再按需在 profile 的 `cordis.yml` 中调整以下参数：

```yaml
dsh-iui:
  jev:
    enabled: true            # 设为 false 时始终使用规则
    endpoint: https://api.typesafe.ai/v1/systemone
    model: jev-latest
    apiKeyEnv: TYPESAFE_API_KEY
    timeoutMs: 4000
    minConfidence: 0.5       # Jev 置信度低于该值时改用规则
```

启用 Jev 后，卡片的标题和内容块会发送给 TypeSafe 用于决策。不希望内容离开本机时，把 `enabled` 设为 `false`。

## 开发

```sh
pnpm install && pnpm --dir island install
pnpm run build       # 构建沙箱渲染器并嵌入，然后构建插件
pnpm run typecheck
pnpm run test
pnpm run gallery -- /tmp/iui-gallery light   # 把全部组件变体渲染成一张截图（首次运行前先执行 npx playwright install chromium）
```

本地调试时，用 `dsh plugin --profile <profile> add <本仓库路径>` 链接插件；修改并重新构建后，刷新页面即可生效。

`scripts/render-cards.mjs` 从会话记录中取出卡片并按完整高度截图。`scripts/demo.mjs` 对一个运行中的 DSH 服务录制端到端演示。

## 许可

MIT。沙箱渲染器打包了第三方代码，其许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
