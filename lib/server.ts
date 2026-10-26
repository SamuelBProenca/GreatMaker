import { resolve } from "node:path";
import { Store } from "../packages/persistence";
import { createApi } from "./api";

const globalStore = globalThis as unknown as { designrefStore?: Store };
export function getApi() {
  const store = globalStore.designrefStore ??= new Store({
    directory: resolve(process.env.DESIGNREF_DATA_DIR || "data"),
    idleHours: Number(process.env.SESSION_IDLE_HOURS || 24), maxHours: Number(process.env.SESSION_MAX_HOURS || 168)
  });
  return createApi(store, process.env.APP_ORIGIN || "http://127.0.0.1:3000");
}
