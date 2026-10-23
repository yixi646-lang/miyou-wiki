import { createHash } from "node:crypto";

export function notModified(req, etag, modified) {
  const supplied = req.headers["if-none-match"];
  if (supplied)
    return supplied
      .split(",")
      .some(
        (value) =>
          value.trim() === "*" ||
          value.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""),
      );
  const since = Date.parse(req.headers["if-modified-since"] ?? "");
  return (
    Number.isFinite(since) &&
    modified &&
    Math.floor(modified.getTime() / 1000) <= Math.floor(since / 1000)
  );
}

export function staticCacheHeaders(info) {
  return {
    ETag: `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`,
    "Last-Modified": info.mtime.toUTCString(),
    "Cache-Control": "public, max-age=0, must-revalidate",
  };
}

export function createPublicJSONCache() {
  const cache = new Map();
  return function publicJSON(req, res, key, signature, value) {
    let item = cache.get(key);
    if (!item || item.signature !== signature) {
      const body = JSON.stringify(
        typeof value === "function" ? value() : value,
      );
      item = {
        signature,
        body,
        etag: '"' + createHash("sha256").update(body).digest("hex") + '"',
      };
      cache.set(key, item);
    }
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: item.etag,
    };
    if (notModified(req, item.etag)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, {
      ...headers,
      "Content-Length": Buffer.byteLength(item.body),
    });
    res.end(req.method === "HEAD" ? undefined : item.body);
  };
}
