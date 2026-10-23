import { seedCatalog } from "./catalog-seed.mjs";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateEntry, isExcludedEntry } from "../shared/catalog.mjs";

export function openLibrary(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, game TEXT NOT NULL, category TEXT NOT NULL,
      name TEXT NOT NULL, payload TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_game_category ON entries(game, category);
    CREATE TABLE IF NOT EXISTS favorites (
      entry_id TEXT PRIMARY KEY REFERENCES entries(id), created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = 1;
  `);
  const read = db.prepare(
    "SELECT payload, revision, updated_at FROM entries WHERE id = ?",
  );
  const list = db.prepare("SELECT payload, revision, updated_at FROM entries");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO entries(id,game,category,name,payload,updated_at) VALUES(?,?,?,?,?,?)",
  );
  const deserialize = (row) =>
    row && {
      ...JSON.parse(row.payload),
      revision: row.revision,
      updatedAt: row.updated_at,
    };
  const transactional = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const insertOne = (entry) => {
    validateEntry(entry);
    return Number(
      insert.run(
        entry.id,
        entry.game,
        entry.category,
        entry.name,
        JSON.stringify(entry),
        new Date().toISOString(),
      ).changes,
    );
  };

  return {
    db,
    get(id) {
      return deserialize(read.get(id));
    },
    all(game) {
      return (
        game
          ? db
              .prepare(
                "SELECT payload,revision,updated_at FROM entries WHERE game=?",
              )
              .all(game)
          : list.all()
      ).map(deserialize);
    },
    count() {
      return db.prepare("SELECT COUNT(*) AS n FROM entries").get().n;
    },
    counts() {
      return db
        .prepare(
          "SELECT game,category,COUNT(*) AS count,SUM(CASE WHEN json_extract(payload,'$.releaseDate') IS NOT NULL AND json_extract(payload,'$.releaseDate')!='' THEN 1 ELSE 0 END) AS dated FROM entries GROUP BY game,category",
        )
        .all();
    },
    signature(game) {
      return JSON.stringify(
        db
          .prepare(
            "SELECT game,COUNT(*) AS n,SUM(revision) AS revisions,MAX(updated_at) AS updated FROM entries WHERE (? IS NULL OR game=?) GROUP BY game",
          )
          .all(game ?? null, game ?? null),
      );
    },
    seedReport: null,
    seed(directory) {
      this.seedReport = seedCatalog({
        db,
        directory,
        insertOne,
        transactional,
      });
      return this.seedReport.added;
    },
    create(entry) {
      validateEntry(entry);
      if (!insertOne(entry))
        throw Object.assign(new Error("相同编号的条目已存在，未覆盖。"), {
          status: 409,
        });
      return this.get(entry.id);
    },
    update(id, entry, revision) {
      if (!this.get(id))
        throw Object.assign(new Error("条目不存在。"), { status: 404 });
      validateEntry({ ...entry, id });
      const result = db
        .prepare(
          "UPDATE entries SET game=?, category=?, name=?, payload=?, revision=revision+1, updated_at=? WHERE id=? AND revision=?",
        )
        .run(
          entry.game,
          entry.category,
          entry.name,
          JSON.stringify({ ...entry, id }),
          new Date().toISOString(),
          id,
          revision,
        );
      if (!result.changes)
        throw Object.assign(
          new Error("条目已被其他页面修改，请刷新后再编辑。"),
          { status: 409 },
        );
      return this.get(id);
    },
    favorites() {
      return db
        .prepare("SELECT entry_id FROM favorites ORDER BY created_at DESC")
        .all()
        .map((row) => row.entry_id);
    },
    favorite(id, wanted) {
      if (!this.get(id))
        throw Object.assign(new Error("条目不存在。"), { status: 404 });
      if (wanted)
        db.prepare(
          "INSERT OR IGNORE INTO favorites(entry_id,created_at) VALUES(?,?)",
        ).run(id, new Date().toISOString());
      else db.prepare("DELETE FROM favorites WHERE entry_id=?").run(id);
      return this.favorites();
    },
    previewImport(payload) {
      const entries = Array.isArray(payload) ? payload : payload?.entries;
      if (!Array.isArray(entries) || entries.length > 10000)
        throw new Error("导入文件须包含 entries 数组，最多 10000 条。");
      const seen = new Set();
      const conflicts = [],
        additions = [],
        errors = [],
        excluded = [];
      for (const [index, entry] of entries.entries()) {
        try {
          if (isExcludedEntry(entry)) {
            excluded.push({
              id: entry.id,
              name: entry.name,
              reason: "不收录邦布及邦布频道",
            });
            continue;
          }
          validateEntry(entry);
          if (seen.has(entry.id)) throw new Error("导入文件中存在重复编号。");
          seen.add(entry.id);
          const local = this.get(entry.id);
          (local ? conflicts : additions).push({
            id: entry.id,
            name: entry.name,
            game: entry.game,
            category: entry.category,
          });
        } catch (error) {
          errors.push({
            index,
            name: entry?.name ?? "",
            message: error.message,
          });
        }
      }
      return { additions, conflicts, errors, excluded, count: entries.length };
    },
    importAdditions(payload) {
      const preview = this.previewImport(payload);
      if (preview.errors.length)
        throw new Error("导入文件包含无效条目，请修正后再导入。");
      const entries = Array.isArray(payload) ? payload : payload.entries;
      const favorites = Array.isArray(payload?.favorites)
        ? payload.favorites
        : [];
      return transactional(() => {
        let added = 0;
        for (const entry of entries)
          if (!isExcludedEntry(entry)) added += insertOne(entry);
        for (const id of favorites)
          if (typeof id === "string" && this.get(id))
            db.prepare(
              "INSERT OR IGNORE INTO favorites(entry_id,created_at) VALUES(?,?)",
            ).run(id, new Date().toISOString());
        for (const [game, plan] of Object.entries(payload?.growthPlans ?? {}))
          if (
            ["genshin", "starrail", "zenless"].includes(game) &&
            plan &&
            Array.isArray(plan.goals) &&
            plan.goals.length <= 1000 &&
            plan.inventory &&
            typeof plan.inventory === "object"
          )
            db.prepare(
              "INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)",
            ).run(`growth_plan:${game}`, JSON.stringify(plan));
        return {
          added,
          skipped: preview.conflicts.length,
          excluded: preview.excluded.length,
          favorites: this.favorites(),
        };
      });
    },
    export() {
      return {
        format: "xingye-wiki",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entries: this.all(),
        favorites: this.favorites(),
        growthPlans: Object.fromEntries(
          db
            .prepare(
              "SELECT key,value FROM metadata WHERE key LIKE 'growth_plan:%'",
            )
            .all()
            .map((row) => [row.key.slice(12), JSON.parse(row.value)]),
        ),
      };
    },
    close() {
      db.close();
    },
  };
}
