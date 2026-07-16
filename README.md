# @spatialhydro/flashcast-sdk

FLASHCAST HTTP API 的 TypeScript 合约、请求构造器与客户端。该包不包含 UI，可用于 Node.js 18+ 和浏览器环境。

## 要解决的问题

山洪研究与预警需要把降雨、蒸散等气象驱动转化为流域径流，并据此回答三个实际问题：**这场雨会产生多大来水、未来一段时间会怎样变化、模型能否用历史观测得到可靠约束**。

本包是连接应用与 FLASHCAST 水文服务的通用工具。它让不同的网页、脚本或服务以一致方式获取流域信息，开展模拟和预报，用历史资料率定模型，并识别洪水过程；从而避免同一流域在不同调用方得到难以比较的计算结果。

## 功能

- **流域与资料查询**：获取流域范围、基础信息、可用站点、模型和强迫数据说明。
- **水文模拟与预报**：提交指定流域、模型和时段的计算，取得径流过程及评价结果。
- **模型率定**：利用历史资料搜索合适的模型参数，跟踪长时间率定任务并支持取消。
- **洪水过程识别**：按规则划分洪水事件，或重新识别已有时段中的洪水过程。
- **计算可靠性检查**：检查服务、空间数据和模型数据是否可用，便于在研究或业务计算前发现问题。
- **一致的数据接口**：为上述输入和输出提供统一的类型与请求构造，保证不同调用方采用相同的数据含义。

## 安装

```bash
npm install @spatialhydro/flashcast-sdk
```

从源码开发：

```bash
npm ci --ignore-scripts
npm run build
```

## 使用

```ts
import {
  buildSiteSimulateRequest,
  createFlashcastClient,
  runCalibrationAsync,
} from "@spatialhydro/flashcast-sdk";

const client = createFlashcastClient({ baseUrl: "/api" });

const request = buildSiteSimulateRequest("孤山", "XAJ", {
  t_start: "2020-01-01",
  t_end: "2020-12-31",
});
const result = await client.simulateModel(request);

const calibration = await runCalibrationAsync(client, {
  site: "孤山",
  maxn: 1000,
});
```

## 导入入口

| 入口                                        | 内容                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `@spatialhydro/flashcast-sdk`               | 全部公共 API                                             |
| `@spatialhydro/flashcast-sdk/contracts`     | API 合约与领域类型                                       |
| `@spatialhydro/flashcast-sdk/client`        | HTTP 客户端                                              |
| `@spatialhydro/flashcast-sdk/requests`      | simulate、forecast、calibrate 和 event-divide 请求构造器 |
| `@spatialhydro/flashcast-sdk/calibration`   | 异步率定辅助函数                                         |
| `@spatialhydro/flashcast-sdk/check-backend` | 后端连通性检查                                           |

## 命令

```bash
npm run build       # 编译到 dist/
npm test            # 离线单元测试
npm run test:smoke  # 集成冒烟测试；需可访问兼容服务
npm run smoke       # 运行内置连通性检查 CLI
```

发布包只包含 `dist/` 和本文件；请从包根入口或上述子路径导入公共 API，不要依赖 `src/` 内部实现。
