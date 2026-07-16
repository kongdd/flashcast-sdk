import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCalibrationAsync, CalibrationProtocolError } from "../dist/index.js";

function resultBody() {
  return {
    site: "s",
    area_km2: 1,
    params: {},
    metrics: {},
    events: [],
    series: { time: [], P: [], Q_obs: [], Q_sim: [] },
  };
}

function mockClient(sequence, cancelCalls = { n: 0 }, hooks = {}) {
  let i = 0;
  return {
    async startCalibrationJob(_body, signal) {
      hooks.onStart?.(signal);
      return { job_id: "job-1", status: "queued" };
    },
    async fetchCalibrationJob(_id, signal) {
      hooks.onFetch?.(signal);
      const step = sequence[Math.min(i++, sequence.length - 1)];
      return step;
    },
    async cancelCalibrationJob() {
      cancelCalls.n += 1;
      if (hooks.cancelThrows) throw new Error("cancel failed");
      return { job_id: "job-1", cancelled: true };
    },
  };
}

describe("runCalibrationAsync", () => {
  it("done with result", async () => {
    const updates = [];
    const res = await runCalibrationAsync(
      mockClient([
        { status: "queued", site: "s" },
        { status: "running", site: "s", iter: 1 },
        { status: "done", site: "s", result: resultBody() },
      ]),
      { site: "s", maxn: 100 },
      { pollIntervalMs: 0, onUpdate: (j) => updates.push(j.status) },
    );
    assert.equal(res.site, "s");
    assert.deepEqual(updates, ["queued", "queued", "running", "done"]);
  });

  it("failed with log_file", async () => {
    await assert.rejects(
      () =>
        runCalibrationAsync(
          mockClient([{ status: "failed", error: "boom", log_file: "/tmp/f.log" }]),
          { site: "s" },
          { pollIntervalMs: 0, onUpdate: () => {} },
        ),
      /boom.*\/tmp\/f\.log/,
    );
  });

  it("cancelled throws AbortError", async () => {
    await assert.rejects(
      () =>
        runCalibrationAsync(
          mockClient([{ status: "cancelled", message: "stopped" }]),
          { site: "s" },
          { pollIntervalMs: 0, onUpdate: () => {} },
        ),
      (e) => e.name === "AbortError",
    );
  });

  it("client abort calls cancel once", async () => {
    const cancelCalls = { n: 0 };
    const ac = new AbortController();
    const client = mockClient([{ status: "running" }], cancelCalls);
    ac.abort();
    await assert.rejects(
      () =>
        runCalibrationAsync(client, { site: "s" }, {
          signal: ac.signal,
          pollIntervalMs: 0,
          onUpdate: () => {},
        }),
      (e) => e.name === "AbortError",
    );
    assert.equal(cancelCalls.n, 1);
  });

  it("done without result is protocol error", async () => {
    await assert.rejects(
      () =>
        runCalibrationAsync(
          mockClient([{ status: "done" }]),
          { site: "s" },
          { pollIntervalMs: 0, onUpdate: () => {} },
        ),
      (e) => e instanceof CalibrationProtocolError,
    );
  });

  it("abort during sleep cancels once", async () => {
    const cancelCalls = { n: 0 };
    const ac = new AbortController();
    const client = mockClient(
      [{ status: "running" }, { status: "running" }],
      cancelCalls,
    );
    const p = runCalibrationAsync(client, { site: "s" }, {
      signal: ac.signal,
      pollIntervalMs: 200,
      onUpdate: () => {},
    });
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    await assert.rejects(p, (e) => e.name === "AbortError");
    assert.equal(cancelCalls.n, 1);
  });

  it("abort during fetch cancels once", async () => {
    const cancelCalls = { n: 0 };
    const ac = new AbortController();
    let fetchStarted = false;
    const client = {
      async startCalibrationJob() {
        return { job_id: "job-1", status: "queued" };
      },
      async fetchCalibrationJob(_id, signal) {
        fetchStarted = true;
        return new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
            { once: true },
          );
          ac.abort();
        });
      },
      async cancelCalibrationJob() {
        cancelCalls.n += 1;
        return { job_id: "job-1", cancelled: true };
      },
    };
    await assert.rejects(
      () =>
        runCalibrationAsync(client, { site: "s" }, {
          signal: ac.signal,
          pollIntervalMs: 0,
          onUpdate: () => {},
        }),
      (e) => e.name === "AbortError",
    );
    assert.equal(fetchStarted, true);
    assert.equal(cancelCalls.n, 1);
  });

  it("cancel failure does not mask AbortError during sleep", async () => {
    const cancelCalls = { n: 0 };
    const ac = new AbortController();
    const client = mockClient(
      [{ status: "running" }],
      cancelCalls,
      { cancelThrows: true },
    );
    const p = runCalibrationAsync(client, { site: "s" }, {
      signal: ac.signal,
      pollIntervalMs: 100,
      onUpdate: () => {},
    });
    await new Promise((r) => setTimeout(r, 10));
    ac.abort();
    await assert.rejects(p, (e) => e.name === "AbortError" && !(e instanceof Error && e.message === "cancel failed"));
    assert.equal(cancelCalls.n, 1);
  });
});