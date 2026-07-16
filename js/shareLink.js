/* insight Analytics — shareable-link codec (window.ShareLink)

   P10 share link: serialize a full portable project bundle (ProjectStore.exportJSON → toPortable)
   into a URL fragment so a project can be shared as a single link with NO backend. The fragment
   (`#p=…`) is never sent to a server, keeping the no-build / local-first model intact. Opening a
   `#p=…` link decodes it back to a bundle that ProjectStore.importJSON validates + activates.

   Security depends on A1 (formula column safe parser): a shared bundle's Formula Columns are
   evaluated by window.FormulaEval, NOT new Function — so a malicious link can't run code.

   Layering (so the deterministic parts are unit-testable in Node while compression is browser-async):
     • Pure/deterministic (tested): bundle↔JSON↔bytes↔base64url, fragment build/parse, size math.
     • Async wrapper: encodeShareLink/decodeShareFragment use CompressionStream when available and
       fall back to no compression. A 1-char codec tag records which path was used:
         'r' = raw (base64url of UTF-8 JSON, no compression)
         'z' = deflate-raw compressed, then base64url
*/
(function () {
  "use strict";

  // Conservative cap on the FULL shared URL length. Browsers/servers vary; ~64k is safe almost
  // everywhere, but chat apps and some address bars truncate earlier, so we warn past 32k of payload.
  var MAX_PAYLOAD_CHARS = 32000;

  // ── UTF-8 ↔ bytes ──────────────────────────────────────────────────
  function utf8Encode(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    return Uint8Array.from(Buffer.from(str, "utf8")); // Node fallback
  }
  function utf8Decode(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
    return Buffer.from(bytes).toString("utf8");
  }

  // ── bytes ↔ base64url (URL-safe, no padding) ───────────────────────
  function bytesToBase64url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = (typeof btoa !== "undefined") ? btoa(bin) : Buffer.from(bytes).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function base64urlToBytes(s) {
    var b64 = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof atob !== "undefined") {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return Uint8Array.from(Buffer.from(b64, "base64"));
  }

  // ── deterministic core (no compression) ────────────────────────────
  // Encode a bundle → 'r'-tagged base64url payload string. Pure + synchronous.
  function encodeRaw(bundle) {
    var json = JSON.stringify(bundle);
    return "r" + bytesToBase64url(utf8Encode(json));
  }
  // Decode any payload string (tag-aware) → bundle object. `inflate` (optional) is a fn
  // (Uint8Array) → Uint8Array used for the 'z' tag; omit it and 'z' payloads throw.
  function decodePayload(payload, inflate) {
    if (typeof payload !== "string" || payload.length < 1) throw new Error("Empty share payload");
    var tag = payload[0];
    var body = payload.slice(1);
    var bytes = base64urlToBytes(body);
    if (tag === "z") {
      if (typeof inflate !== "function") throw new Error("Compressed payload requires an inflate function");
      bytes = inflate(bytes);
    } else if (tag !== "r") {
      throw new Error('Unknown share codec tag "' + tag + '"');
    }
    var json = utf8Decode(bytes);
    var obj;
    try { obj = JSON.parse(json); } catch (e) { throw new Error("Corrupt share payload: " + e.message); }
    return obj;
  }

  // ── fragment (#p=…) build/parse ────────────────────────────────────
  function buildFragment(payload) { return "#p=" + payload; }
  // Extract the payload from a hash / full URL / bare fragment. Returns null when absent.
  function parseFragment(hashOrUrl) {
    if (!hashOrUrl) return null;
    var s = String(hashOrUrl);
    var hashIdx = s.indexOf("#");
    var hash = hashIdx >= 0 ? s.slice(hashIdx + 1) : s;   // allow passing a bare fragment too
    // hash may be "p=…" or "a=1&p=…"
    var parts = hash.split("&");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i];
      if (kv.slice(0, 2) === "p=") return decodeURIComponent(kv.slice(2));
    }
    return null;
  }

  // ── async wrappers (browser CompressionStream, graceful fallback) ──
  async function deflate(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    var cs = new CompressionStream("deflate-raw");
    var writer = cs.writable.getWriter();
    writer.write(bytes); writer.close();
    var buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function inflateAsync(bytes) {
    var ds = new DecompressionStream("deflate-raw");
    var writer = ds.writable.getWriter();
    writer.write(bytes); writer.close();
    var buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  // Build a share payload from a bundle, compressing when possible. Returns
  //   { payload, tag, compressed, chars, tooLarge }
  async function encodePayload(bundle) {
    var json = JSON.stringify(bundle);
    var jsonBytes = utf8Encode(json);
    var payload, tag, compressed;
    var deflated = null;
    try { deflated = await deflate(jsonBytes); } catch (e) { deflated = null; }
    if (deflated && deflated.length < jsonBytes.length) {
      payload = "z" + bytesToBase64url(deflated);
      tag = "z"; compressed = true;
    } else {
      payload = "r" + bytesToBase64url(jsonBytes);
      tag = "r"; compressed = false;
    }
    return { payload: payload, tag: tag, compressed: compressed, chars: payload.length, tooLarge: payload.length > MAX_PAYLOAD_CHARS };
  }

  // Build a full share URL from a base (e.g. location.origin+pathname) and a bundle.
  async function encodeShareLink(baseUrl, bundle) {
    var enc = await encodePayload(bundle);
    return { url: String(baseUrl).replace(/#.*$/, "") + buildFragment(enc.payload), payload: enc.payload, compressed: enc.compressed, chars: enc.chars, tooLarge: enc.tooLarge };
  }

  // Decode a hash/URL back to a bundle (async — handles 'z' via DecompressionStream).
  async function decodeShareFragment(hashOrUrl) {
    var payload = parseFragment(hashOrUrl);
    if (payload == null) return null;
    return decodePayload(payload, function () { throw new Error("sync inflate not available"); }) ;
  }
  // Async variant that can inflate 'z' payloads. Returns bundle or null when no fragment.
  async function decodeShareFragmentAsync(hashOrUrl) {
    var payload = parseFragment(hashOrUrl);
    if (payload == null) return null;
    if (payload[0] === "z") {
      var bytes = await inflateAsync(base64urlToBytes(payload.slice(1)));
      var json = utf8Decode(bytes);
      return JSON.parse(json);
    }
    return decodePayload(payload);
  }

  var api = {
    // deterministic (unit-tested)
    encodeRaw: encodeRaw,
    decodePayload: decodePayload,
    buildFragment: buildFragment,
    parseFragment: parseFragment,
    bytesToBase64url: bytesToBase64url,
    base64urlToBytes: base64urlToBytes,
    MAX_PAYLOAD_CHARS: MAX_PAYLOAD_CHARS,
    // async (browser)
    encodePayload: encodePayload,
    encodeShareLink: encodeShareLink,
    decodeShareFragmentAsync: decodeShareFragmentAsync,
  };
  if (typeof window !== "undefined") window.ShareLink = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
