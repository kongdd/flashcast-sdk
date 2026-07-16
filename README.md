# @spatialhydro/flashcast-sdk

> 山洪预报平台后端
FLASHCAST HTTP contracts & client（无 UI）。Node 18+ / 浏览器可用，无 React、Zustand 依赖。

## 安装（本仓库）

```bash
# 前端会通过 file: 依赖链接本包，并在 build/predev 时 prepare
cd frontend && npm run prepare:sdk
```

## 使用

```ts
import {
  createFlashcastClient,
  buildSiteSimulateRequest,
  runCalibrationAsync,
  checkBackend,
} from "@spatialhydro/flashcast-sdk";

const client = createFlashcastClient({ baseUrl: "/api" }); // 或 http://127.0.0.1:8765/api

// 常规模拟：默认不传 params，由 Julia resolve_theta(site) 使用率定/默认参数
const body = buildSiteSimulateRequest("孤山", "XAJ", {
  t_start: "2020-01-01",
  t_end: "2020-12-31",
});
const sim = await client.simulateModel(body);

// 异步率定（poll + AbortSignal cancel）
const ac = new AbortController();
const cal = await runCalibrationAsync(client, { site: "孤山", maxn: 1000 }, {
  signal: ac.signal,
  onUpdate: (job) => console.log(job.status, job.iter),
});
```

### 子路径

| 入口                          | 内容                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `@spatialhydro/flashcast-sdk` | 全部导出                                                |
| `.../client`                  | `createFlashcastClient`                                 |
| `.../contracts`               | API 类型                                                |
| `.../requests`                | simulate / forecast / calibrate / event-divide builders |
| `.../calibration`             | `runCalibrationAsync`                                   |

## 后端预检

```ts
import { checkBackend, formatCheckBackendReport } from "@spatialhydro/flashcast-sdk";

const r = await checkBackend({
  baseUrl: "http://127.0.0.1:8765/api",
  // includeSimulate: true, // 可选短时段模拟
});
console.log(formatCheckBackendReport(r));
```

CLI：

```bash
# 需先 npm run build（或 npm pack / prepare）
node packages/flashcast-sdk/dist/cli.js
node packages/flashcast-sdk/dist/cli.js --simulate --site 孤山

# 安装后
npx flashcast-smoke
FLASHCAST_BASE_URL=http://127.0.0.1:8765/api npx flashcast-smoke -s
```

检查顺序：`/health` → `/status` → `/extent` → `/model/catalog` → `/model/sites` → `/model/params` → 可选 `simulate`。

## 开发

```bash
cd packages/flashcast-sdk
npm ci --ignore-scripts
npm test          # 离线单测
npm run test:smoke  # 需 Rust :8765 + Julia 代理
```
