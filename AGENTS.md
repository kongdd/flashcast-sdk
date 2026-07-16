# AGENTS.md — `@spatialhydro/flashcast-sdk`

## 定位

这是 FLASHCAST 的 TypeScript HTTP 合约与客户端包；运行于 Node 18+ 和浏览器，不依赖 React 或 Zustand。它是前端与后端 API 的边界层，保持轻量、可独立发布。

## 代码组织

- `src/contracts.ts`：API 请求、响应和领域类型。
- `src/requests.ts`：请求构造与参数规范化。
- `src/client.ts`：HTTP 客户端及公开调用入口。
- `src/calibration.ts`：率定相关客户端调用。
- `src/checkBackend.ts`、`src/cli.ts`：后端预检及 CLI。
- `src/index.ts`：包的公共导出；新增公共 API 时在此处显式导出。
- `test/*.test.mjs`：离线单元测试；`test/integration/`：依赖真实服务的冒烟测试。

## 开发约定

- TypeScript 使用严格模式、ES2020、`NodeNext` 模块解析；源码中的相对导入保持与现有 NodeNext 规范一致。
- 先更新 `contracts.ts`，再同步客户端、请求构造、公共导出和测试，确保类型与实际 API 一致。
- 维持浏览器兼容性：不要引入 Node 专属依赖到通用客户端模块。
- 仅在参数页的手动模拟中传递 `params`；常规 `simulate` 让服务端使用率定参数或默认值。
- 代码应简洁、职责单一；保留有意义的注释和错误上下文。

## 文档

- `README.md` 只说明本包的职责、安装、公共 API、开发与测试；不要加入其他仓库、应用或部署的说明。

## 验证

```bash
npm run build                    # TypeScript 编译
npm test                         # 离线单元测试（首选）
npm run test:smoke               # 需 Rust :8765 与 Julia 代理
```

- 改动公共接口、请求或响应类型时，至少运行 `npm test`。
- 不要在未明确具备后端环境时运行或依赖 `test:smoke` 的结果。
- 当前工作区可能包含用户的未提交修改；只改动任务所需文件。
