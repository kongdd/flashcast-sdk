import type {
  CalibrationRequest,
  DivideFloodEventsRequest,
  EventRules,
  ForcingOverrides,
  ForecastRequest,
  SiteSimulateFields,
  SimulateRequest,
} from "./contracts.js";

/** 后端 HydroFloods 仍用「天」；网页以小时调节。 */
export function gapMaxDaysFromHours(hours: number): number {
  return hours / 24;
}

export function gapMaxHoursFromDays(days: number): number {
  return days * 24;
}

export function eventRulesToRequest(
  rules: Pick<EventRules, "q_min" | "q_peak" | "gap_max_hours" | "min_hours" | "gap_hours" | "extend_hours">,
): Pick<
  SiteSimulateFields,
  "threshold" | "q_min" | "q_peak" | "gap_max_days" | "min_hours" | "gap_hours" | "extend_hours"
> {
  return {
    threshold: rules.q_peak,
    q_min: rules.q_min,
    q_peak: rules.q_peak,
    gap_max_days: gapMaxDaysFromHours(rules.gap_max_hours),
    min_hours: rules.min_hours,
    gap_hours: rules.gap_hours,
    extend_hours: rules.extend_hours,
  };
}

export type FloodRulesCatalog = import("./contracts.js").FloodRulesCatalog;

/** 将后端 YAML 目录转为 EventRules（保留 min_hours 等本地项）。 */
export function eventRulesFromCatalog(
  site: string,
  catalog: FloodRulesCatalog,
  base: EventRules,
): EventRules {
  const block = catalog.sites[site] ?? catalog.default;
  const gapDays = block.gap_max_days ?? catalog.default.gap_max_days ?? 2;
  return {
    ...base,
    q_min: block.Q_min,
    q_peak: block.Q_peak,
    threshold: block.Q_peak,
    gap_max_hours: gapMaxHoursFromDays(gapDays),
  };
}

type ForcingKey = keyof ForcingOverrides;

function pickForcingOverrides(
  overrides: ForcingOverrides | undefined,
  keys: readonly ForcingKey[],
): ForcingOverrides | undefined {
  if (!overrides) return undefined;
  const out: ForcingOverrides = {};
  let any = false;
  for (const key of keys) {
    if (overrides[key] !== undefined) {
      out[key] = overrides[key];
      any = true;
    }
  }
  return any ? out : undefined;
}

function mergeAllowedForcing<T extends object>(
  base: T,
  overrides: ForcingOverrides | undefined,
  keys: readonly ForcingKey[],
): T {
  const picked = pickForcingOverrides(overrides, keys);
  if (!picked) return base;
  return { ...base, ...picked };
}

function hasNonEmptyParams(params?: Record<string, number> | null): params is Record<string, number> {
  return params != null && Object.keys(params).length > 0;
}

/**
 * 有资料流域：默认不传 params，由 Julia resolve_theta 使用率定/默认参数。
 * 仅在显式非空 params 时加入 params 键。
 */
export function buildSiteSimulateRequest(
  site: string,
  modelId: string,
  fields: SiteSimulateFields,
  params?: Record<string, number> | null,
  forcingOverrides?: ForcingOverrides,
): SimulateRequest {
  const base: SimulateRequest = { site, model_id: modelId, ...fields };
  const merged = mergeAllowedForcing(base, forcingOverrides, ["forcing"]);
  if (hasNonEmptyParams(params)) {
    return { ...merged, params };
  }
  return merged;
}

export function buildSiteForecastRequest(
  body: Omit<ForecastRequest, keyof ForcingOverrides>,
  forcingOverrides?: ForcingOverrides,
): ForecastRequest {
  return mergeAllowedForcing({ ...body }, forcingOverrides, ["history_forcing", "forecast_forcing"]);
}

export function buildSiteCalibrationRequest(
  body: CalibrationRequest,
  forcingOverrides?: ForcingOverrides,
): CalibrationRequest {
  return mergeAllowedForcing({ ...body }, forcingOverrides, ["forcing"]);
}

export function buildSiteEventDivideRequest(
  site: string,
  windows: { historyStart: string; historyEnd: string },
  eventRules: EventRules,
  forcingOverrides?: ForcingOverrides,
  includeStoredFloodRules = true,
): DivideFloodEventsRequest {
  const floodRules = includeStoredFloodRules ? eventRulesToRequest(eventRules) : {};
  const base: DivideFloodEventsRequest = {
    site,
    t_start: windows.historyStart,
    t_end: windows.historyEnd,
    min_hours: eventRules.min_hours,
    gap_hours: eventRules.gap_hours,
    extend_hours: eventRules.extend_hours,
    ...floodRules,
  };
  return mergeAllowedForcing(base, forcingOverrides, ["forcing"]);
}

/** @deprecated use eventRulesToRequest */
export const floodRulesForApi = eventRulesToRequest;