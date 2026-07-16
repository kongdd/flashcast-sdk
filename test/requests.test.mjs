import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSiteSimulateRequest,
  buildSiteForecastRequest,
  buildSiteCalibrationRequest,
  buildSiteEventDivideRequest,
  eventRulesToRequest,
  gapMaxDaysFromHours,
  gapMaxHoursFromDays,
} from "../dist/index.js";

describe("buildSiteSimulateRequest params omission", () => {
  const fields = { t_start: "2020-01-01", t_end: "2020-12-31" };
  for (const params of [undefined, null, {}]) {
    it(`omits params for ${String(params)}`, () => {
      const req = buildSiteSimulateRequest("孤山", "XAJ", fields, params);
      assert.equal(Object.hasOwn(req, "params"), false);
      assert.equal(Object.hasOwn(req, "theta"), false);
    });
  }
  it("includes non-empty params", () => {
    const req = buildSiteSimulateRequest("孤山", "XAJ", fields, { K: 0.8 });
    assert.equal(req.params.K, 0.8);
  });
});

describe("calibration request", () => {
  it("only_flood_events and forcing", () => {
    const req = buildSiteCalibrationRequest(
      { site: "s", only_flood_events: true, maxn: 500 },
      { forcing: { P: [1, 2] } },
    );
    assert.equal(req.only_flood_events, true);
    assert.deepEqual(req.forcing.P, [1, 2]);
    assert.equal(Object.hasOwn(req, "params"), false);
    assert.equal(Object.hasOwn(req, "history_forcing"), false);
    assert.equal(Object.hasOwn(req, "forecast_forcing"), false);
  });
});

describe("forecast request forcing keys", () => {
  it("drops forcing and keeps history/forecast forcing", () => {
    const req = buildSiteForecastRequest(
      { site: "s", history_end: "a", forecast_start: "b" },
      {
        forcing: { P: [9] },
        history_forcing: { P: [1] },
        forecast_forcing: { P: [2] },
      },
    );
    assert.equal(Object.hasOwn(req, "forcing"), false);
    assert.deepEqual(req.history_forcing.P, [1]);
    assert.deepEqual(req.forecast_forcing.P, [2]);
  });
});

describe("event divide", () => {
  it("uses forcing only (Julia contract)", () => {
    const rules = {
      q_min: 1,
      q_peak: 10,
      gap_max_hours: 48,
      min_hours: 6,
      gap_hours: 12,
      extend_hours: 3,
    };
    const req = buildSiteEventDivideRequest(
      "site",
      { historyStart: "a", historyEnd: "b" },
      rules,
      { forcing: { P: [0] } },
    );
    assert.equal(Object.hasOwn(req, "history_forcing"), false);
    assert.deepEqual(req.forcing.P, [0]);
    assert.equal(req.t_start, "a");
    assert.equal(req.gap_max_days, 2);
  });
});

describe("flood rules hours/days", () => {
  it("0 hours", () => assert.equal(gapMaxDaysFromHours(0), 0));
  it("48h = 2d", () => assert.equal(gapMaxDaysFromHours(48), 2));
  it("round trip", () => assert.equal(gapMaxHoursFromDays(gapMaxDaysFromHours(36)), 36));
  it("eventRulesToRequest threshold", () => {
    const r = eventRulesToRequest({
      q_min: 1,
      q_peak: 9,
      gap_max_hours: 24,
      min_hours: 6,
      gap_hours: 12,
      extend_hours: 3,
    });
    assert.equal(r.threshold, 9);
    assert.equal(r.gap_max_days, 1);
  });
});