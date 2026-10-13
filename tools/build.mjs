import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const source = new URL("../public/", import.meta.url);
const target = new URL("../dist/", import.meta.url);
// Resolve and verify the exact generated directory before removing stale assets.
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (resolve(fileURLToPath(target)) !== resolve(project, "dist"))
  throw new Error("Invalid build target");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log("dndrun → dist");
