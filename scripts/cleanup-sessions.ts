import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { Store } from "../packages/persistence";
loadEnvConfig(process.cwd());
const store = new Store({ directory: resolve(process.env.DESIGNREF_DATA_DIR || "data"), idleHours: Number(process.env.SESSION_IDLE_HOURS || 24), maxHours: Number(process.env.SESSION_MAX_HOURS || 168) });
const result = store.cleanup();
store.close();
console.log(JSON.stringify(result));
if (result.pending) process.exitCode = 1;
