import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";

const source = new URL("../public/", import.meta.url);
const target = new URL("../dist/", import.meta.url);

test("a clean build removes stale assets and includes every runtime file", async () => {
  await mkdir(target, { recursive: true });
  await writeFile(new URL("obsolete.js", target), "stale asset");
  await import("../tools/build.mjs");
  const names = (await readdir(source)).sort();
  assert.deepEqual((await readdir(target)).sort(), names);
  for (const name of names) {
    assert.deepEqual(
      await readFile(new URL(name, target)),
      await readFile(new URL(name, source)),
    );
  }
  const html = await readFile(new URL("index.html", target), "utf8");
  for (const [, asset] of html.matchAll(/(?:src|href)="\.\/(.*?)"/g)) {
    assert.ok(names.includes(asset), `Missing page asset: ${asset}`);
  }
  for (const name of names.filter((name) => name.endsWith(".js"))) {
    const script = await readFile(new URL(name, target), "utf8");
    for (const [, dependency] of script.matchAll(/from\s+['"]\.\/(.*?)['"]/g)) {
      assert.ok(names.includes(dependency), `Missing module: ${dependency}`);
    }
  }
});
