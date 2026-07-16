import { createFlashcastClient, type FlashcastClient, type FlashcastClientOptions } from "./client.js";

export type BackendCheckName =
  | "health"
  | "status"
  | "extent"
  | "model_catalog"
  | "model_sites"
  | "model_params"
  | "simulate";

export type BackendCheckStatus = "ok" | "fail" | "skip";

export interface BackendCheckItem {
  name: BackendCheckName;
  status: BackendCheckStatus;
  ms: number;
  detail?: string;
  error?: string;
}

export interface CheckBackendOptions extends FlashcastClientOptions {
  /** Override client; when set, baseUrl/fetch/headers are ignored. */
  client?: FlashcastClient;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Include optional short simulate probe (default false). */
  includeSimulate?: boolean;
  site?: string;
  modelId?: string;
  /** Simulate window length in hours when includeSimulate (default 24). */
  simulateHours?: number;
}

export interface CheckBackendResult {
  ok: boolean;
  baseUrl: string;
  checks: BackendCheckItem[];
  sites: string[];
  defaultModel?: string;
  site?: string;
  modelId?: string;
}

function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<T> {
  if (timeoutMs <= 0 && !outer) return run(new AbortController().signal);

  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onOuter = () => ac.abort(outer?.reason);
  if (outer) {
    if (outer.aborted) ac.abort(outer.reason);
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  if (timeoutMs > 0) {
    timer = setTimeout(() => ac.abort(new DOMException("backend check timeout", "AbortError")), timeoutMs);
  }

  return run(ac.signal).finally(() => {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener("abort", onOuter);
  });
}

async function timed(
  name: BackendCheckName,
  fn: () => Promise<string | undefined>,
): Promise<BackendCheckItem> {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { name, status: "ok", ms: Date.now() - t0, detail };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { name, status: "fail", ms: Date.now() - t0, error };
  }
}

/**
 * Probe Rust spatial API and Julia model proxy.
 * Order: health → status → extent → model/catalog → model/sites → model/params → optional short simulate.
 */
export async function checkBackend(options: CheckBackendOptions = {}): Promise<CheckBackendResult> {
  const baseUrl = options.baseUrl ?? "/api";
  const timeoutMs = options.timeoutMs ?? 8000;
  const client =
    options.client ??
    createFlashcastClient({
      baseUrl,
      fetch: options.fetch,
      headers: options.headers,
    });

  const checks: BackendCheckItem[] = [];
  let sites: string[] = [];
  let defaultModel: string | undefined;
  let site = options.site;
  let modelId = options.modelId;

  checks.push(
    await timed("health", async () => {
      const h = await withTimeout((s) => client.fetchHealth(s), timeoutMs, options.signal);
      if (h.status !== "ok") throw new Error(`unexpected health status: ${h.status}`);
      return h.status;
    }),
  );

  checks.push(
    await timed("status", async () => {
      const st = await withTimeout((s) => client.fetchStatus(s), timeoutMs, options.signal);
      if (!st.rasters_loaded) throw new Error("rasters_loaded=false");
      return "rasters_loaded";
    }),
  );

  checks.push(
    await timed("extent", async () => {
      const e = await withTimeout((s) => client.fetchExtent(s), timeoutMs, options.signal);
      if (!(e.rows > 0 && e.cols > 0)) throw new Error("invalid extent");
      return `${e.rows}x${e.cols}`;
    }),
  );

  checks.push(
    await timed("model_catalog", async () => {
      const c = await withTimeout((s) => client.fetchModelCatalog(s), timeoutMs, options.signal);
      if (!c.default || !Array.isArray(c.models) || c.models.length === 0) {
        throw new Error("empty model catalog");
      }
      defaultModel = c.default;
      modelId = modelId ?? c.default;
      return `${c.models.length} models, default=${c.default}`;
    }),
  );

  checks.push(
    await timed("model_sites", async () => {
      sites = await withTimeout((s) => client.fetchModelSites(s), timeoutMs, options.signal);
      if (!sites.length) throw new Error("no model sites");
      site = site ?? sites[0];
      return `${sites.length} sites`;
    }),
  );

  if (site) {
    checks.push(
      await timed("model_params", async () => {
        const p = await withTimeout(
          (s) => client.fetchModelParams(site, modelId, s),
          timeoutMs,
          options.signal,
        );
        return `${p.params?.length ?? 0} params${p.source ? ` · ${p.source}` : ""}`;
      }),
    );
  } else {
    checks.push({ name: "model_params", status: "skip", ms: 0, detail: "no site" });
  }

  if (options.includeSimulate) {
    if (!site) {
      checks.push({ name: "simulate", status: "skip", ms: 0, detail: "no site" });
    } else {
      checks.push(
        await timed("simulate", async () => {
          const hours = options.simulateHours ?? 24;
          const end = new Date();
          const start = new Date(end.getTime() - hours * 3600_000);
          const iso = (d: Date) => d.toISOString().slice(0, 19);
          // 常规模拟默认不传 params
          const res = await withTimeout(
            (s) =>
              client.simulateModel(
                {
                  site: site!,
                  model_id: modelId,
                  t_start: iso(start),
                  t_end: iso(end),
                },
                s,
              ),
            Math.max(timeoutMs, 30_000),
            options.signal,
          );
          const n = res.series?.time?.length ?? 0;
          return `site=${res.site} series=${n}`;
        }),
      );
    }
  }

  const ok = checks.every((c) => c.status !== "fail");
  return { ok, baseUrl, checks, sites, defaultModel, site, modelId };
}

export function formatCheckBackendReport(result: CheckBackendResult): string {
  const lines = [
    `FLASHCAST backend check  baseUrl=${result.baseUrl}  ${result.ok ? "OK" : "FAIL"}`,
  ];
  for (const c of result.checks) {
    const mark = c.status === "ok" ? "✓" : c.status === "skip" ? "·" : "✗";
    const extra = c.detail ?? c.error ?? "";
    lines.push(`  ${mark} ${c.name.padEnd(14)} ${String(c.ms).padStart(5)}ms  ${extra}`);
  }
  if (result.site) lines.push(`  site=${result.site}  model=${result.modelId ?? "-"}`);
  return lines.join("\n");
}
