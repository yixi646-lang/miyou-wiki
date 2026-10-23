import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { isExcludedEntry } from "../shared/catalog.mjs";

// 文件清单先判断变动；内容指纹仍是批次身份，stat 变动后才读文件。
export function seedCatalog({ db, directory, insertOne, transactional }) {
  const report = { mode: "missing", filesRead: 0, bytesRead: 0, added: 0 };
  if (!existsSync(directory)) return report;
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const manifest = JSON.stringify(
    files.map((name) => {
      const s = statSync(join(directory, name));
      return [name, s.size, s.mtimeMs, s.ctimeMs, String(s.ino)];
    }),
  );
  const get = (key) =>
    db.prepare("SELECT value FROM metadata WHERE key=?").get(key)?.value;
  if (get("seed-files:v3") === manifest) {
    report.mode = "manifest-hit";
    return report;
  }
  const fingerprint = createHash("sha256"),
    buffers = [];
  for (const file of files) {
    const bytes = readFileSync(join(directory, file));
    report.filesRead++;
    report.bytesRead += bytes.length;
    fingerprint.update(file).update(bytes);
    buffers.push(bytes);
  }
  const digest = fingerprint.digest("hex");
  return transactional(() => {
    const set = db.prepare(
      "INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)",
    );
    if (get("seed-fingerprint:v2") === digest) {
      report.mode = "content-hit";
      set.run("seed-files:v3", manifest);
      return report;
    }
    for (const bytes of buffers) {
      const data = JSON.parse(bytes.toString("utf8"));
      if (!Array.isArray(data.entries)) continue;
      for (const entry of data.entries)
        if (!isExcludedEntry(entry)) report.added += insertOne(entry);
    }
    set.run("seed-fingerprint:v2", digest);
    set.run("seed-files:v3", manifest);
    db.exec("PRAGMA optimize");
    report.mode = "import";
    return report;
  });
}
