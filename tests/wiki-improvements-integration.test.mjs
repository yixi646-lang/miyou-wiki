import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";

test("隔离服务：条件缓存、全文索引、409最新资料及两次启动", async (t) => {
  const root = resolve(".codex_tmp");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "wiki-improvement-server-"));
  let child;
  const portProbe = createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  const origin = "http://127.0.0.1:" + port;
  async function start() {
    const at = performance.now();
    child = spawn(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", "server.mjs", "--port=" + port],
      {
        cwd: resolve("."),
        env: {
          ...process.env,
          WIKI_DB_PATH: join(directory, "wiki.sqlite"),
          WIKI_BACKUP_DIR: join(directory, "backups"),
          WIKI_ASSESSMENT_DB_PATH: join(directory, "assessment.sqlite"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (bytes) => {
      output += bytes;
    });
    child.stderr.on("data", (bytes) => {
      output += bytes;
    });
    await Promise.race([
      new Promise((resolve, reject) => {
        child.stdout.on("data", () => {
          if (output.includes("Wiki 已启动：")) resolve();
        });
        child.once("exit", (code) =>
          reject(Error("服务启动失败 " + code + " " + output)),
        );
      }),
      new Promise((_, reject) => {
        const timer = setTimeout(
          () => reject(Error("服务启动超时 " + output)),
          45000,
        );
        timer.unref();
      }),
    ]);
    return performance.now() - at;
  }
  async function stop() {
    if (!child) return;
    const process = child;
    child = null;
    const exited = once(process, "exit");
    process.kill();
    await exited;
  }
  const get = (path, options = {}) =>
    fetch(origin + path, { ...options, signal: AbortSignal.timeout(60000) });
  try {
    const cold = await start(),
      staticResponse = await get("/base.css"),
      etag = staticResponse.headers.get("etag");
    assert(etag);
    assert(staticResponse.headers.get("last-modified"));
    assert.equal(
      (await get("/base.css", { headers: { "If-None-Match": etag } })).status,
      304,
    );
    const bootResponse = await get("/api/bootstrap");
    assert.equal(bootResponse.headers.get("cache-control"), "no-store");
    const boot = await bootResponse.json();
    const catalogResponse = await get("/api/catalog?game=zenless"),
      catalogTag = catalogResponse.headers.get("etag"),
      catalog = await catalogResponse.json();
    assert.equal(
      (
        await get("/api/catalog?game=zenless", {
          headers: { "If-None-Match": catalogTag },
        })
      ).status,
      304,
    );
    const researchAt = performance.now(),
      researchResponse = await get("/api/research-index?game=zenless"),
      research = await researchResponse.json(),
      researchMs = performance.now() - researchAt;
    assert(research.entries.some((entry) => entry.sections.length));
    assert(research.mechanisms.length > 50);
    assert(research.mechanisms.every((item) => item.sources.length));
    assert.equal(
      (
        await get("/api/research-index?game=zenless", {
          headers: { "If-None-Match": researchResponse.headers.get("etag") },
        })
      ).status,
      304,
    );
    const entry = await (
      await get(
        "/api/entries/" +
          catalog.entries.find((e) => e.category === "characters").id,
      )
    ).json();
    const patch = (payload) =>
      get("/api/entries/" + entry.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Wiki-Token": boot.token,
        },
        body: JSON.stringify(payload),
      });
    assert.equal(
      (
        await patch({
          entry: { ...entry, name: "隔离测试更新" },
          revision: entry.revision,
        })
      ).status,
      200,
    );
    const conflict = await patch({ entry, revision: entry.revision });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).current.name, "隔离测试更新");
    assert.equal(
      (
        await get("/api/catalog?game=zenless", {
          headers: { "If-None-Match": catalogTag },
        })
      ).status,
      200,
    );
    await stop();
    const warm = await start();
    assert.equal((await get("/api/health")).status, 200);
    t.diagnostic(
      JSON.stringify({
        coldStartMs: Math.round(cold),
        warmStartMs: Math.round(warm),
        firstResearchIndexMs: Math.round(researchMs),
        mechanisms: research.mechanisms.length,
        formalDatabaseUsed: false,
      }),
    );
  } finally {
    await stop();
    assert(directory.startsWith(root + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
