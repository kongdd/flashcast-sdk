import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkBackend,
  formatCheckBackendReport,
  createFlashcastClient,
} from "../dist/index.js";

function ok(body) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    async text() {
      return JSON.stringify(body);
    },
    async json() {
      return body;
    },
  };
}

function fail(status, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: false,
    status,
    statusText: "Error",
    headers: new Headers({ "content-type": "application/json" }),
    async text() {
      return text;
    },
    async json() {
      return typeof body === "string" ? {} : body;
    },
  };
}

function mockFetch(routes) {
  return async (url) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "").replace(/^\/api/, "") || "/";
    for (const [prefix, handler] of Object.entries(routes)) {
      if (path === prefix || path.startsWith(prefix + "?") || path.startsWith(prefix + "/")) {
        return typeof handler === "function" ? handler(path) : handler;
      }
    }
    return fail(404, { error: `no route ${path}` });
  };
}

const healthyRoutes = {
  "/health": ok({ status: "ok" }),
  "/status": ok({ rasters_loaded: true }),
  "/extent": ok({
    xmin: 0, ymin: 0, xmax: 1, ymax: 1,
    cell_size_x: 1, cell_size_y: 1, rows: 10, cols: 20,
  }),
  "/model/catalog": ok({
    default: "XAJ",
    models: [{ id: "XAJ", name: "XAJ" }],
  }),
  "/model/sites": ok({ sites: ["孤山", "黄龙"] }),
  "/model/params": ok({
    params: [{ name: "K", min: 0, max: 1, value: 0.5 }],
    source: "default",
  }),
  "/model/simulate": ok({
    site: "孤山",
    area_km2: 1,
    params: {},
    metrics: {},
    events: [],
    series: { time: ["t0"], P: [0], Q_obs: [0], Q_sim: [0] },
  }),
};

describe("checkBackend", () => {
  it("all probes ok without simulate", async () => {
    const result = await checkBackend({
      baseUrl: "http://127.0.0.1:8765/api",
      fetch: mockFetch(healthyRoutes),
      timeoutMs: 2000,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.checks.map((c) => c.name),
      ["health", "status", "extent", "model_catalog", "model_sites", "model_params"],
    );
    assert.ok(result.checks.every((c) => c.status === "ok"));
    assert.equal(result.site, "孤山");
    assert.equal(result.modelId, "XAJ");
  });

  it("includeSimulate posts without params", async () => {
    let simulateBody;
    const routes = {
      ...healthyRoutes,
      "/model/simulate": async () => {
        return ok({
          site: "孤山",
          area_km2: 1,
          params: {},
          metrics: {},
          events: [],
          series: { time: ["a", "b"], P: [0, 0], Q_obs: [0, 0], Q_sim: [0, 0] },
        });
      },
    };
    const fetch = async (url, init) => {
      if (String(url).includes("/model/simulate")) {
        simulateBody = JSON.parse(init.body);
      }
      return mockFetch(routes)(url, init);
    };
    const result = await checkBackend({
      baseUrl: "/api",
      fetch,
      includeSimulate: true,
      timeoutMs: 2000,
    });
    assert.equal(result.ok, true);
    assert.equal(result.checks.at(-1).name, "simulate");
    assert.equal(result.checks.at(-1).status, "ok");
    assert.equal(Object.hasOwn(simulateBody, "params"), false);
    assert.equal(simulateBody.site, "孤山");
  });

  it("fails when health is down", async () => {
    const result = await checkBackend({
      baseUrl: "/api",
      fetch: mockFetch({ "/health": fail(502, { error: "down" }) }),
      timeoutMs: 500,
    });
    assert.equal(result.ok, false);
    assert.equal(result.checks[0].status, "fail");
  });

  it("timeout aborts and clears timer", async () => {
    const fetch = async (_url, init) =>
      new Promise((resolve, reject) => {
        const onAbort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (init?.signal?.aborted) onAbort();
        else init?.signal?.addEventListener("abort", onAbort, { once: true });
        // never resolves without abort
      });
    const t0 = Date.now();
    const result = await checkBackend({
      baseUrl: "/api",
      fetch,
      timeoutMs: 50,
    });
    const elapsed = Date.now() - t0;
    assert.equal(result.ok, false);
    assert.equal(result.checks[0].status, "fail");
    assert.ok(elapsed < 2000, `should not hang, elapsed=${elapsed}`);
  });

  it("format report", async () => {
    const result = await checkBackend({
      baseUrl: "/api",
      fetch: mockFetch(healthyRoutes),
    });
    const text = formatCheckBackendReport(result);
    assert.match(text, /OK/);
    assert.match(text, /health/);
  });

  it("accepts injected client", async () => {
    const client = createFlashcastClient({
      baseUrl: "/api",
      fetch: mockFetch(healthyRoutes),
    });
    const result = await checkBackend({ client, timeoutMs: 1000 });
    assert.equal(result.ok, true);
  });
});
