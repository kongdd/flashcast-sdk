#!/usr/bin/env node
/**
 * flashcast-smoke — probe Rust (:8765) + Julia proxy.
 *
 *   npx flashcast-smoke
 *   FLASHCAST_BASE_URL=http://127.0.0.1:8765/api npx flashcast-smoke --simulate
 */
import { checkBackend, formatCheckBackendReport } from "./checkBackend.js";

/** Minimal process typings so the package stays free of @types/node. */
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
};

function parseArgs(argv: string[]) {
  let baseUrl = process.env.FLASHCAST_BASE_URL ?? "http://127.0.0.1:8765/api";
  let includeSimulate = false;
  let site: string | undefined;
  let modelId: string | undefined;
  let timeoutMs = 8000;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--simulate" || a === "-s") includeSimulate = true;
    else if (a === "--base-url" || a === "-b") baseUrl = argv[++i] ?? baseUrl;
    else if (a === "--site") site = argv[++i];
    else if (a === "--model") modelId = argv[++i];
    else if (a === "--timeout") timeoutMs = Number(argv[++i] ?? timeoutMs);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: flashcast-smoke [options]
  --base-url, -b   API root (default env FLASHCAST_BASE_URL or http://127.0.0.1:8765/api)
  --simulate, -s   include short simulate probe
  --site           site name for params/simulate
  --model          model id
  --timeout        per-check timeout ms (default 8000)
`);
      process.exit(0);
    }
  }
  return { baseUrl, includeSimulate, site, modelId, timeoutMs };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = await checkBackend(opts);
  console.log(formatCheckBackendReport(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
