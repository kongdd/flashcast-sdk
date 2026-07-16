import type { FlashcastClient } from "./client.js";
import type { CalibrationRequest, CalibrationJobStatus, SimulateResult } from "./contracts.js";

export interface ActiveCalibration {
  jobId: string;
  site: string;
  status: CalibrationJobStatus;
  maxn: number;
  iter?: number;
  feval?: number;
  best_gof?: number | null;
  message?: string;
  from_cache?: boolean;
  log_file?: string | null;
}

export interface RunCalibrationAsyncOptions {
  signal?: AbortSignal;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onUpdate: (job: ActiveCalibration) => void;
}

function isAbortError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e && e.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("率定已取消", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("率定已取消", "AbortError"));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort);
  });
}

async function bestEffortCancelOnce(
  client: FlashcastClient,
  jobId: string,
  state: { done: boolean },
): Promise<void> {
  if (state.done) return;
  state.done = true;
  try {
    await client.cancelCalibrationJob(jobId);
  } catch {
    /* already finished or network error */
  }
}

export class CalibrationProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalibrationProtocolError";
  }
}

export async function runCalibrationAsync(
  client: FlashcastClient,
  body: CalibrationRequest,
  options: RunCalibrationAsyncOptions,
): Promise<SimulateResult> {
  const pollMs = options.pollIntervalMs ?? 1500;
  const maxWait = options.maxWaitMs ?? 3_600_000;
  const onUpdate = options.onUpdate;
  const signal = options.signal;

  const { job_id: jobId } = await client.startCalibrationJob(body, signal);
  const cancelState = { done: false };

  onUpdate({
    jobId,
    site: body.site,
    status: "queued",
    maxn: body.maxn ?? 1000,
    message: "已提交率定任务",
  });

  const started = Date.now();
  while (true) {
    if (Date.now() - started > maxWait) {
      throw new CalibrationProtocolError("率定轮询超时");
    }
    if (signal?.aborted) {
      await bestEffortCancelOnce(client, jobId, cancelState);
      throw new DOMException("率定已取消", "AbortError");
    }

    let job;
    try {
      job = await client.fetchCalibrationJob(jobId, signal);
    } catch (e) {
      if (isAbortError(e)) {
        await bestEffortCancelOnce(client, jobId, cancelState);
        throw e;
      }
      throw e;
    }

    const status = job.status;
    onUpdate({
      jobId,
      site: job.site ?? body.site,
      status,
      maxn: job.maxn ?? body.maxn ?? 1000,
      iter: job.iter,
      feval: job.feval,
      best_gof: job.best_gof ?? null,
      message: job.message,
      from_cache: Boolean(job.from_cache ?? (job.result as { from_cache?: boolean } | undefined)?.from_cache),
      log_file: job.log_file ?? null,
    });

    if (status === "done") {
      if (!job.result) {
        throw new CalibrationProtocolError("率定完成但缺少 result");
      }
      const res = { ...job.result } as SimulateResult & {
        from_cache?: boolean;
        message?: string;
        calibration?: SimulateResult["calibration"];
      };
      const fromCache = Boolean(res.from_cache ?? job.from_cache);
      if (fromCache) {
        res.calibration = {
          ...res.calibration,
          from_cache: true,
          maxn_requested: body.maxn ?? 1000,
        };
      }
      return res;
    }
    if (status === "cancelled") {
      throw new DOMException(job.message ?? "率定已取消", "AbortError");
    }
    if (status === "failed") {
      const logHint = job.log_file ? ` · 日志 ${job.log_file}` : "";
      throw new Error((job.error ?? job.message ?? "率定失败") + logHint);
    }
    if (status !== "queued" && status !== "running") {
      throw new CalibrationProtocolError(`未知率定状态: ${status}`);
    }

    try {
      await sleep(pollMs, signal);
    } catch (e) {
      if (isAbortError(e)) {
        await bestEffortCancelOnce(client, jobId, cancelState);
        throw e;
      }
      throw e;
    }
  }
}