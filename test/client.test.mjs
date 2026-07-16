import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  createFlashcastClient,
  FlashcastApiError,
  joinApiUrl,
} from "../dist/index.js";

function mockResponse({ ok, status = ok ? 200 : 500, statusText = ok ? "OK" : "Error", body, contentType = "application/json" }) {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
  return {
    ok,
    status,
    statusText,
    headers: new Headers({ "content-type": contentType }),
    async text() {
      return text;
    },
    async json() {
      return JSON.parse(text);
    },
  };
}

describe("joinApiUrl", () => {
  it("default relative health", () => {
    assert.equal(joinApiUrl("/api", "/health"), "/api/health");
  });
  it("absolute api root with trailing slash", () => {
    assert.equal(
      joinApiUrl("http://127.0.0.1:8765/api/", "/model/sites"),
      "http://127.0.0.1:8765/api/model/sites",
    );
  });
  it("subpath deploy prefix", () => {
    assert.equal(joinApiUrl("/flashcast/api/", "model/catalog"), "/flashcast/api/model/catalog");
  });
});

describe("client errors (single body read)", () => {
  it("JSON error with error field", async () => {
    const fetch = async () => mockResponse({ ok: false, status: 502, body: { error: "upstream down" } });
    const client = createFlashcastClient({ baseUrl: "/api", fetch });
    await assert.rejects(
      () => client.fetchHealth(),
      (e) => e instanceof FlashcastApiError && e.status === 502 && e.message.includes("upstream down"),
    );
  });
  it("plain text error", async () => {
    const fetch = async () =>
      mockResponse({ ok: false, status: 400, body: "bad request", contentType: "text/plain" });
    const client = createFlashcastClient({ baseUrl: "/api", fetch });
    await assert.rejects(
      () => client.fetchHealth(),
      (e) => e instanceof FlashcastApiError && e.bodyText === "bad request",
    );
  });
  it("malformed JSON error body", async () => {
    const fetch = async () => mockResponse({ ok: false, status: 500, body: "{not-json", contentType: "application/json" });
    const client = createFlashcastClient({ baseUrl: "/api", fetch });
    await assert.rejects(
      () => client.fetchHealth(),
      (e) => e instanceof FlashcastApiError && e.message.includes("500"),
    );
  });
});

describe("progress 404", () => {
  it("returns null only for progress 404", async () => {
    const fetch = async (url) => {
      if (url.endsWith("/progress/missing")) return mockResponse({ ok: false, status: 404 });
      return mockResponse({ ok: true, body: { stage: "x", message: "", elapsed_ms: 0, done: false } });
    };
    const client = createFlashcastClient({ baseUrl: "/api", fetch });
    assert.equal(await client.fetchProgress("missing"), null);
    const p = await client.fetchProgress("ok");
    assert.equal(p.stage, "x");
  });
});

describe("POST simulate", () => {
  it("sends JSON body and signal", async () => {
    let seen;
    const fetch = async (url, init) => {
      seen = { url, init };
      return mockResponse({ ok: true, body: { site: "s", area_km2: 1, params: {}, metrics: {}, events: [], series: { time: [], P: [], Q_obs: [], Q_sim: [] } } });
    };
    const ac = new AbortController();
    const client = createFlashcastClient({ baseUrl: "http://127.0.0.1:8765/api", fetch });
    await client.simulateModel({ site: "孤山", model_id: "XAJ" }, ac.signal);
    assert.equal(seen.url, "http://127.0.0.1:8765/api/model/simulate");
    assert.equal(seen.init.method, "POST");
    assert.equal(JSON.parse(seen.init.body).site, "孤山");
    assert.equal(seen.init.signal, ac.signal);
  });
});