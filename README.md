# dsh-iui（前端）

对标 OpenAI Intelligent UI 的 DSH 自建插件 **前端侧**：白名单组件库、流式 `ops` 渲染、本地会话状态。

## 范围（本期）

- 组件：`chart` / `form` / `button` / `row` / `col` / `text`
- `pending` / `none` 不挂树
- ops：`upsert` | `patchProps` | `remove`
- 事件：`{ type: "action", key, action, payload }`
- 状态：`localStorage`，键 `会话 + block key`

Jev 选 type、增量编译在**后端（插件宿主）**；本包只消费已填完整 `type` 的 ops。

## 本地演示

```bash
cd dsh-iui
npm install
npm run dev
```

打开终端打印的地址，点「自动流式播放」即可验收三件套 + 事件 + 刷新后表单值仍在。

## 接入 DSH

```bash
dsh plugin --profile web add ./dsh-iui
```

完整 `conversation.chat.node` slot 注册需与宿主 ops 桥对接后启用（见 `src/client/plugin.ts`）。



## 从 Git 安装（dsh / pnpm）

仓库已提交预构建 `lib/`，**没有** `prepare` 生命周期脚本，pnpm 无需 `allowBuilds`。

```bash
dsh plugin --profile desktop add https://github.com/zengwenliang416/dsh-iui.git
# 或本地路径：
# git clone https://github.com/zengwenliang416/dsh-iui.git && cd dsh-iui && dsh plugin --profile desktop add "$(pwd)"
```

改源码后本地执行 `npm run build`，再把 `lib/` 一并提交。

## 宿主（后端）

同仓 `src/host`：

- skill：教主模型出 `dsh-iui` payload（`type` 可 `pending`）
- Jev 闸门：按块选 `chart|form|button|text|none`；无 `JEV_API_KEY` 时用 props 形状启发式
- 置信度 `< 0.7` → 可选主模型回退 → 再失败降级 `text`
- 编译出 `upsert` / `remove` ops，经 `createHostBridge` 推给前端
- action / session-state 写回会话上下文

本地冒烟：

```bash
node --experimental-strip-types scripts/smoke-host.mjs
```

## 前后端桥（已对齐）

进程内：`createHostBridge` → `pushOps` / `onOps` + `emitAction` / `onAction`。

```bash
npm run smoke:bridge   # 宿主 fence→Jev→ops→applyOps 森林 + action 回传
```

演示页已改为走同一条链路（不再手写假 ops）。

真机 `conversation.chat.node`：client `apply` 在 slots API 可用时软注册 `id: dsh-iui`，渲染侧用 `IuiMount` + `attachBridge(ctx.dshIui.bridge)`。缺真实 DSH profile 时以 smoke + Vite 演示验收。

## 真机安装（web profile）草案

前置：本机已能 `dsh web`；本仓库 `npm install` 完成。

```bash
# 1) 装进 web profile（路径用绝对路径）
dsh plugin --profile web add /workspace/dsh-iui

# 2) 可选：Jev 真闸门（不设则走 props 启发式）
export JEV_API_KEY=jv_live_xxx

# 3) 启动（若需 overlay，按 DSH 文档用 --patch）
dsh web
```

加载顺序约定：宿主 `dsh-iui-host`（`src/host/plugin.ts`）先挂 `ctx.dshIui.bridge`，客户端 `dsh-iui-client`（`src/client/plugin.ts`）再 `attachBridge`。会话里应能加载 skill `dsh-iui`；模型出 ` ```dsh-iui ` fence 后走编译→ops→slot。

验收本地仍用：`npm run smoke:bridge` + `npm run dev`。

## 真机状态

- 已 `dsh plugin --profile web add /workspace/dsh-iui`，bundle 在 profile 中
- 宿主 fiber：`provide('dshIui')` 已激活；客户端 inject 在同进程冒烟可通过
- **跨进程**：Client 已接 `dsh-iui/ops` match + `conversation.chat.node`；需重启 `dsh web` 验真机槽位
- 当前可看效果：Vite 演示 http://127.0.0.1:5173/
- `dsh web` 已起：http://127.0.0.1:3080/（插件已加载；聊天内嵌 UI 需补 wire）

需要 Node ≥ 22 跑官方 dsh CLI。

## 真机过线（宿主事件）

宿主在 `assistant/message` 结算后编译 fence，并往当前 Session 追加：

- `dsh-iui/ops`：`{ sessionKey, turn?, step?, ops, sourceMessageId? }` — Web Client 用 `uiConversation.events.register`（`conversationEvents.match`）认这个事件
- Client 挂 `conversation.chat.node`，`key: dsh-iui`，渲染 `IuiForest`
- `dsh-iui/action`：点击/提交后写入；宿主 `followup`/`steer` 带上 `[dsh-iui action]` 催续聊
- 状态变更：`agent.inject` 注入 `[dsh-iui session-state]`

改完后需重启 `dsh web` 才会加载新 bundle。
