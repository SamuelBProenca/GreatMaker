import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { Store } from "../packages/persistence";
loadEnvConfig(process.cwd());
const store = new Store({ directory: resolve(process.env.DESIGNREF_DATA_DIR || "data") });
store.close();
console.log("SQLite migrations applied.");
