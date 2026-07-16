import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFlashcastClient } from "../../dist/index.js";

const baseUrl = process.env.FLASHCAST_BASE_URL ?? "http://127.0.0.1:8765/api";
const timeoutMs = 8000;

function withTimeout(promise) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const raced = promise(ac.signal);
  return raced.finally(() => clearTimeout(timer));
}

describe("rust + julia proxy smoke", () => {
  const client = createFlashcastClient({ baseUrl });

  it("GET /health", async () => {
    const h = await withTimeout((signal) => client.fetchHealth(signal));
    assert.equal(h.status, "ok");
  });

  it("GET /status", async () => {
    const s = await withTimeout((signal) => client.fetchStatus(signal));
    assert.equal(s.rasters_loaded, true);
  });

  it("GET /extent", async () => {
    const e = await withTimeout((signal) => client.fetchExtent(signal));
    assert.ok(e.rows > 0 && e.cols > 0);
    assert.ok(Number.isFinite(e.xmin) && Number.isFinite(e.xmax));
  });

  it("GET /model/catalog via Rust proxy", async () => {
    const c = await withTimeout((signal) => client.fetchModelCatalog(signal));
    assert.ok(c.default);
    assert.ok(Array.isArray(c.models) && c.models.length > 0);
  });

  it("GET /model/sites", async () => {
    const sites = await withTimeout((signal) => client.fetchModelSites(signal));
    assert.ok(sites.length >= 1);
  });
});