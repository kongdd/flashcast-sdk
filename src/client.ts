import type { FeatureCollection } from "./geojson.js";
import type {
  BasinInfo,
  CalculationProgress,
  CalibrationJob,
  DivideFloodEventsRequest,
  EventDivideResult,
  FloodRedetectResult,
  FloodRulesCatalog,
  ForecastRequest,
  ForecastResult,
  ForcingMeta,
  ModelBenchmarkSiteResponse,
  ModelCatalogResponse,
  ModelParamsResponse,
  ModelParamMeta,
  CalibrationHint,
  RedetectFloodEventsRequest,
  SimulateCustomRequest,
  SimulateRequest,
  SimulateResult,
  StartCalibrationResponse,
  WatershedRequest,
  WatershedResponse,
  DemExtent,
  CalibrationRequest,
} from "./contracts.js";

export interface FlashcastClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
}

export class FlashcastApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly bodyText?: string;
  readonly payload?: unknown;

  constructor(
    message: string,
    opts: { status: number; statusText: string; url: string; bodyText?: string; payload?: unknown },
  ) {
    super(message);
    this.name = "FlashcastApiError";
    this.status = opts.status;
    this.statusText = opts.statusText;
    this.url = opts.url;
    this.bodyText = opts.bodyText;
    this.payload = opts.payload;
  }
}

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function benchmarkFlag(v: unknown): boolean {
  return v === true || v === 1 || v === 1.0;
}

async function readBodyOnce(res: Response): Promise<{ text: string; json?: unknown }> {
  const text = await res.text();
  if (!text) return { text: "" };
  try {
    return { text, json: JSON.parse(text) as unknown };
  } catch {
    return { text };
  }
}

async function jsonOrThrow<T>(res: Response, url: string): Promise<T> {
  if (!res.ok) {
    const { text, json } = await readBodyOnce(res);
    let msg: string;
    if (json && typeof json === "object" && json !== null && "error" in json) {
      const err = (json as { error: unknown }).error;
      msg = typeof err === "string" ? err : JSON.stringify(err);
    } else if (json !== undefined) {
      msg = JSON.stringify(json);
    } else {
      msg = text || res.statusText;
    }
    throw new FlashcastApiError(`${res.status} ${res.statusText}: ${msg}`, {
      status: res.status,
      statusText: res.statusText,
      url,
      bodyText: text,
      payload: json,
    });
  }
  const { json } = await readBodyOnce(res);
  if (json === undefined) {
    throw new FlashcastApiError("Empty response body", {
      status: res.status,
      statusText: res.statusText,
      url,
    });
  }
  return json as T;
}

export interface FlashcastClient {
  fetchHealth(signal?: AbortSignal): Promise<{ status: string }>;
  fetchExtent(signal?: AbortSignal): Promise<DemExtent>;
  fetchStatus(signal?: AbortSignal): Promise<{ rasters_loaded: boolean }>;
  fetchProgress(requestId: string, signal?: AbortSignal): Promise<CalculationProgress | null>;
  fetchWatershed(req: WatershedRequest, signal?: AbortSignal): Promise<WatershedResponse>;
  fetchModelCatalog(signal?: AbortSignal): Promise<ModelCatalogResponse>;
  fetchModelSites(signal?: AbortSignal): Promise<string[]>;
  fetchModelParams(site?: string | null, modelId?: string, signal?: AbortSignal): Promise<ModelParamsResponse>;
  fetchFloodRulesCatalog(signal?: AbortSignal): Promise<FloodRulesCatalog>;
  fetchModelBenchmark(site?: string | null, signal?: AbortSignal): Promise<ModelBenchmarkSiteResponse>;
  fetchModelServiceLogs(signal?: AbortSignal): Promise<{
    log_dir: string;
    service_log: string;
    tail: string[];
    recent_fail_logs: string[];
  }>;
  fetchForcingMeta(site: string, start?: string, end?: string, signal?: AbortSignal): Promise<ForcingMeta>;
  fetchBasinsPourPoints(signal?: AbortSignal): Promise<FeatureCollection>;
  fetchBasins(signal?: AbortSignal): Promise<BasinInfo[]>;
  fetchCalibrationJob(jobId: string, signal?: AbortSignal): Promise<CalibrationJob>;
  simulateModel(body: SimulateRequest, signal?: AbortSignal): Promise<SimulateResult>;
  forecastModel(body: ForecastRequest, signal?: AbortSignal): Promise<ForecastResult>;
  calibrateModel(body: CalibrationRequest, signal?: AbortSignal): Promise<SimulateResult>;
  simulateCustomModel(body: SimulateCustomRequest, signal?: AbortSignal): Promise<SimulateResult>;
  startCalibrationJob(body: CalibrationRequest, signal?: AbortSignal): Promise<StartCalibrationResponse>;
  cancelCalibrationJob(jobId: string, signal?: AbortSignal): Promise<{ job_id: string; cancelled: boolean }>;
  redetectFloodEvents(body: RedetectFloodEventsRequest, signal?: AbortSignal): Promise<FloodRedetectResult>;
  divideFloodEvents(body: DivideFloodEventsRequest, signal?: AbortSignal): Promise<EventDivideResult>;
}

export function createFlashcastClient(options: FlashcastClientOptions = {}): FlashcastClient {
  const baseUrl = options.baseUrl ?? "/api";
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const extraHeaders = options.headers;

  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = joinApiUrl(baseUrl, path);
    const res = await fetchFn(url, { method: "GET", headers: extraHeaders, signal });
    return jsonOrThrow<T>(res, url);
  }

  function jsonHeaders(): HeadersInit {
    const h = new Headers(extraHeaders);
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
    return h;
  }

  async function postModel<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
    const url = joinApiUrl(baseUrl, `/model/${path}`);
    const res = await fetchFn(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    return jsonOrThrow<T>(res, url);
  }

  return {
    async fetchHealth(signal) {
      return get("/health", signal);
    },
    async fetchExtent(signal) {
      return get("/extent", signal);
    },
    async fetchStatus(signal) {
      return get("/status", signal);
    },
    async fetchProgress(requestId, signal) {
      const url = joinApiUrl(baseUrl, `/progress/${encodeURIComponent(requestId)}`);
      const res = await fetchFn(url, { method: "GET", headers: extraHeaders, signal });
      if (res.status === 404) return null;
      return jsonOrThrow<CalculationProgress>(res, url);
    },
    async fetchWatershed(req, signal) {
      const url = joinApiUrl(baseUrl, "/watershed");
      const res = await fetchFn(url, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(req),
        signal,
      });
      return jsonOrThrow(res, url);
    },
    async fetchModelCatalog(signal) {
      return get("/model/catalog", signal);
    },
    async fetchModelSites(signal) {
      const result = await get<{ sites: string[] }>("/model/sites", signal);
      return result.sites;
    },
    async fetchModelParams(site, modelId, signal) {
      const q = new URLSearchParams();
      if (site) q.set("site", site);
      if (modelId) q.set("model", modelId);
      const qs = q.toString() ? `?${q}` : "";
      const url = joinApiUrl(baseUrl, `/model/params${qs}`);
      const res = await fetchFn(url, { method: "GET", headers: extraHeaders, signal });
      const result = await jsonOrThrow<{
        params: Array<ModelParamMeta & { lower?: number; upper?: number }>;
        source?: string;
        calibration_hint?: CalibrationHint;
      }>(res, url);
      const params = result.params.map(({ lower, upper, ...param }) => ({
        ...param,
        min: param.min ?? lower ?? 0,
        max: param.max ?? upper ?? 1,
        recommended: param.recommended ?? param.value,
        value: param.value,
        unit: param.unit?.trim() ? param.unit : undefined,
      }));
      const hint = result.calibration_hint;
      const calibration_hint = hint
        ? {
            ...hint,
            has_calibrated: benchmarkFlag(hint.has_calibrated),
            maxn:
              hint.maxn == null
                ? null
                : typeof hint.maxn === "number"
                  ? hint.maxn
                  : Number(hint.maxn),
          }
        : undefined;
      return { params, source: result.source, calibration_hint };
    },
    async fetchFloodRulesCatalog(signal) {
      return get("/model/flood-rules", signal);
    },
    async fetchModelBenchmark(site, signal) {
      const q = site ? `?site=${encodeURIComponent(site)}` : "";
      return get(`/model/benchmark${q}`, signal);
    },
    async fetchModelServiceLogs(signal) {
      return get("/model/logs", signal);
    },
    async fetchForcingMeta(site, start, end, signal) {
      const q = new URLSearchParams();
      if (start) q.set("start", start);
      if (end) q.set("end", end);
      const qs = q.toString() ? `?${q}` : "";
      return get(`/model/forcing/${encodeURIComponent(site)}${qs}`, signal);
    },
    async fetchBasinsPourPoints(signal) {
      return get("/basins/pour-points", signal);
    },
    async fetchBasins(signal) {
      const result = await get<{ basins: BasinInfo[] }>("/basins", signal);
      return result.basins;
    },
    async fetchCalibrationJob(jobId, signal) {
      return get(`/model/calibrate/${encodeURIComponent(jobId)}`, signal);
    },
    simulateModel: (body, signal) => postModel("simulate", body, signal),
    forecastModel: (body, signal) => postModel("forecast", body, signal),
    calibrateModel: (body, signal) => postModel("calibrate", body, signal),
    simulateCustomModel: (body, signal) => postModel("simulate_custom", body, signal),
    startCalibrationJob: (body, signal) => postModel("calibrate/start", body, signal),
    cancelCalibrationJob: (jobId, signal) =>
      postModel(`calibrate/${encodeURIComponent(jobId)}/cancel`, {}, signal),
    redetectFloodEvents: (body, signal) => postModel("events/redetect", body, signal),
    divideFloodEvents: (body, signal) => postModel("events/divide", body, signal),
  };
}