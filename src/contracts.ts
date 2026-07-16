/** Wire contracts for Rust spatial API and Julia model API (no UI). */

export interface DemExtent {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  cell_size_x: number;
  cell_size_y: number;
  rows: number;
  cols: number;
}

export interface RleRun {
  value: number;
  start: number;
  length: number;
}

export interface BasinStats {
  id: number;
  pixels: number;
  centroid_lon: number;
  centroid_lat: number;
  bbox: { row_min: number; row_max: number; col_min: number; col_max: number };
  area_km2: number;
}

export interface WatershedRequest {
  points: { id?: number; lon: number; lat: number }[];
  snap_dist_m: number;
  snap_main_channel_frac?: number;
  request_id?: string;
}

export interface WatershedResponse {
  mask_rle: RleRun[];
  width: number;
  height: number;
  cell_size_x: number;
  cell_size_y: number;
  origin_lon: number;
  origin_lat: number;
  pour_points_geojson: string;
  basin_stats: BasinStats[];
  walls_ms: number;
  extent: DemExtent;
  mask_png: string | null;
  png_width: number;
  png_height: number;
  watershed_geojson: string | null;
}

export interface CalculationProgress {
  stage: string;
  message: string;
  elapsed_ms: number;
  done: boolean;
}

export interface BasinInfo {
  id: string | number;
  site: string;
  area_km2: number;
  lon: number;
  lat: number;
  name?: string;
  status?: "safe" | "watch" | "alert" | string;
  [key: string]: unknown;
}

export interface ModelParamMeta {
  name: string;
  label?: string;
  description?: string;
  min: number;
  max: number;
  value: number;
  recommended?: number;
  unit?: string;
  group?: string;
}

export interface CalibrationHint {
  has_calibrated: boolean;
  maxn: number | null;
  source?: string;
  updated?: string;
  note?: string | null;
}

export interface HydroSeries {
  time: string[];
  P: number[];
  PET?: number[];
  Q_obs: Array<number | null>;
  Q_sim: Array<number | null>;
  step?: number;
  n_full?: number;
  source_idx?: number[];
}

export interface EventRow {
  id: string;
  split: "TRAIN" | "VALID" | string;
  start: string;
  end: string;
  duration_h: number;
  peak: number;
  peak_sim: number | null;
  NSE: number | null;
  KGE: number | null;
  R2: number | null;
  peak_bias: number | null;
  start_idx: number;
  end_idx: number;
  core_start_idx?: number;
  core_end_idx?: number;
  extend_hours?: number;
}

export interface StageSummary {
  split: "TRAIN" | "VALID" | string;
  n: number;
  hours: number;
  NSE: number | null;
  KGE: number | null;
  R2: number | null;
  peak_bias: number | null;
}

export interface ModelMetrics {
  NSE?: number | null;
  KGE?: number | null;
  R2?: number | null;
  Bias?: number | null;
  n?: number | null;
  [key: string]: number | null | undefined;
}

export interface SimulateResult {
  site: string;
  model_id?: string;
  area_km2: number;
  params: Record<string, number>;
  param_source?: string;
  metrics: ModelMetrics;
  metrics_train?: ModelMetrics;
  metrics_valid?: ModelMetrics;
  events: EventRow[];
  stages?: StageSummary[];
  threshold?: number;
  Q_min?: number;
  Q_peak?: number;
  gap_max_days?: number;
  min_hours?: number;
  gap_hours?: number;
  extend_hours?: number;
  series: HydroSeries;
  period?: { start: string; end: string; n: number };
  calibration?: { params?: Record<string, number>; [key: string]: unknown };
  from_cache?: boolean;
}

export type HistoryResult = Pick<
  SimulateResult,
  | "series"
  | "metrics"
  | "events"
  | "period"
  | "stages"
  | "threshold"
  | "Q_min"
  | "Q_peak"
  | "gap_max_days"
  | "min_hours"
  | "gap_hours"
  | "extend_hours"
  | "param_source"
>;

export interface ForecastResult {
  site: string;
  model_id?: string;
  area_km2: number;
  params: Record<string, number>;
  param_source?: string;
  history: HistoryResult;
  forecast: Pick<SimulateResult, "series" | "metrics" | "period">;
}

export type EventDivideResult = Pick<
  SimulateResult,
  | "site"
  | "area_km2"
  | "series"
  | "events"
  | "stages"
  | "period"
  | "threshold"
  | "Q_min"
  | "Q_peak"
  | "gap_max_days"
  | "min_hours"
  | "gap_hours"
  | "extend_hours"
>;

export interface EventRules {
  q_min: number;
  q_peak: number;
  gap_max_hours: number;
  min_hours: number;
  gap_hours: number;
  extend_hours: number;
  threshold?: number;
}

export interface HydroModelOption {
  id: string;
  label: string;
  n_params: number;
}

export interface ModelCatalogResponse {
  default: string;
  models: HydroModelOption[];
}

export interface ModelParamsResponse {
  params: ModelParamMeta[];
  source?: string;
  calibration_hint?: CalibrationHint;
}

export interface BenchmarkModelRow {
  model_id: string;
  label?: string;
  param_source?: string;
  metrics_valid?: ModelMetrics;
  metrics_train?: ModelMetrics;
  metrics_all?: ModelMetrics;
  split?: {
    train_frac?: number;
    n_train?: number;
    n_valid?: number;
    train_end?: string;
    valid_start?: string;
  };
  error?: string;
}

export interface SiteBenchmarkEntry {
  site: string;
  ranking: string[];
  ranking_labels: string[];
  recommended_line: string;
  rank_metric: string;
  models: Record<string, BenchmarkModelRow>;
}

export interface ModelBenchmarkSiteResponse {
  available: boolean;
  found?: boolean;
  site?: string;
  updated?: string | null;
  spec?: Record<string, unknown>;
  entry?: SiteBenchmarkEntry;
  message?: string;
}

export type CalibrationJobStatus =
  | "queued"
  | "running"
  | "done"
  | "cancelled"
  | "failed";

export interface CalibrationJob {
  job_id: string;
  site?: string;
  status: CalibrationJobStatus;
  maxn?: number;
  iter?: number;
  feval?: number;
  best_gof?: number | null;
  message?: string;
  from_cache?: boolean;
  error?: string | null;
  log_file?: string | null;
  result?: SimulateResult;
}

export interface StartCalibrationResponse {
  job_id: string;
  status: string;
}

export interface ForcingPayload {
  P: number[];
  PET?: number[];
  Q?: number[];
  R?: number[];
  time?: string[];
}

export type ForcingOverrides = {
  forcing?: ForcingPayload | Record<string, unknown>;
  history_forcing?: ForcingPayload | Record<string, unknown>;
  forecast_forcing?: ForcingPayload | Record<string, unknown>;
};

export interface FloodRulesCatalog {
  default: { Q_min: number; Q_peak: number; gap_max_days?: number };
  sites: Record<string, { Q_min: number; Q_peak: number; gap_max_days?: number }>;
}

export interface ForcingMeta {
  site: string;
  area_km2: number;
  period: { start: string; end: string; n: number };
  series?: HydroSeries;
}

export type FloodRedetectResult = Pick<
  SimulateResult,
  | "site"
  | "model_id"
  | "events"
  | "stages"
  | "threshold"
  | "Q_min"
  | "Q_peak"
  | "gap_max_days"
  | "min_hours"
  | "gap_hours"
  | "extend_hours"
>;

export interface SiteSimulateFields {
  t_start?: string;
  t_end?: string;
  threshold?: number;
  q_min?: number;
  q_peak?: number;
  gap_max_days?: number;
  min_hours?: number;
  gap_hours?: number;
  extend_hours?: number;
}

export interface SimulateRequest extends SiteSimulateFields {
  site: string;
  model_id?: string;
  params?: Record<string, number>;
  theta?: number[];
  forcing?: ForcingPayload | Record<string, unknown>;
}

export interface ForecastRequest extends SiteSimulateFields {
  site: string;
  model_id?: string;
  history_start?: string;
  history_end: string;
  forecast_start: string;
  forecast_end?: string;
  params?: Record<string, number>;
  calibrate?: boolean;
  maxn?: number;
  n_warm?: number;
  history_forcing?: ForcingPayload | Record<string, unknown>;
  forecast_forcing?: ForcingPayload | Record<string, unknown>;
}

export interface CalibrationRequest extends SiteSimulateFields {
  site: string;
  model_id?: string;
  maxn?: number;
  fun_gof?: "NSE" | "KGE";
  force?: boolean;
  only_flood_events?: boolean;
  forcing?: ForcingPayload | Record<string, unknown>;
}

export interface RedetectFloodEventsRequest extends SiteSimulateFields {
  site: string;
  model_id?: string;
  check_P?: boolean;
  forcing?: ForcingPayload | Record<string, unknown>;
}

export interface DivideFloodEventsRequest extends SiteSimulateFields {
  site: string;
  check_P?: boolean;
  forcing?: ForcingPayload | Record<string, unknown>;
}

export interface SimulateCustomRequest {
  model_id?: string;
  P: number[];
  PET?: number[];
  Q?: number[];
  R?: number[];
  area_km2: number;
  params?: Record<string, number>;
  time?: string[];
}

export type EventRuleRequestFields = Pick<
  SiteSimulateFields,
  "threshold" | "q_min" | "q_peak" | "gap_max_days" | "min_hours" | "gap_hours" | "extend_hours"
>;