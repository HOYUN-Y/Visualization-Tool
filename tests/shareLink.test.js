const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const SL = require(path.join(__dirname, "..", "js", "shareLink.js"));

// A representative portable bundle (shape mirrors ProjectStore.toPortable output).
const bundle = {
  schemaVersion: 1,
  exportedAt: "2026-07-17T00:00:00.000Z",
  project: { id: "p1", name: "공유 테스트 프로젝트", createdAt: "x", updatedAt: "y" },
  state: { activeId: "d1", mode: "data", tweaks: { lang: "ko" } },
  datasets: [{ id: "d1", name: "D1", columns: [{ key: "a" }, { key: "b" }], rows: [{ a: 1, b: "x" }, { a: 2, b: "y" }] }],
  analysis: {},
};

test("encodeRaw → decodePayload round-trips a bundle exactly", () => {
  const payload = SL.encodeRaw(bundle);
  assert.equal(payload[0], "r");                       // raw codec tag
  const out = SL.decodePayload(payload);
  assert.deepEqual(out, bundle);
});

test("base64url is URL-safe (no + / = ) and reversible on binary", () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 62, 63]);
  const s = SL.bytesToBase64url(bytes);
  assert.ok(!/[+/=]/.test(s), "no +, /, or = in base64url");
  assert.deepEqual(Array.from(SL.base64urlToBytes(s)), Array.from(bytes));
});

test("unicode survives the round-trip", () => {
  const b = { schemaVersion: 1, project: { name: "한글·émoji 🎉·中文" }, state: {}, datasets: [{ id: "d", columns: [] }] };
  assert.deepEqual(SL.decodePayload(SL.encodeRaw(b)), b);
});

test("buildFragment / parseFragment", () => {
  const payload = SL.encodeRaw(bundle);
  const frag = SL.buildFragment(payload);
  assert.ok(frag.startsWith("#p="));
  assert.equal(SL.parseFragment(frag), payload);
  // full URL form
  assert.equal(SL.parseFragment("https://x.dev/index.html" + frag), payload);
  // multi-key hash
  assert.equal(SL.parseFragment("#a=1&p=" + payload), payload);
  // absent
  assert.equal(SL.parseFragment("#other=1"), null);
  assert.equal(SL.parseFragment(""), null);
});

test("decodePayload handles a 'z' (deflate) tag via an injected inflate fn", () => {
  // simulate what the browser CompressionStream produces: deflate-raw of the JSON bytes.
  const json = JSON.stringify(bundle);
  const deflated = zlib.deflateRawSync(Buffer.from(json, "utf8"));
  const payload = "z" + SL.bytesToBase64url(new Uint8Array(deflated));
  const inflate = (bytes) => new Uint8Array(zlib.inflateRawSync(Buffer.from(bytes)));
  const out = SL.decodePayload(payload, inflate);
  assert.deepEqual(out, bundle);
});

test("compression actually shrinks a repetitive bundle", () => {
  const big = { schemaVersion: 1, project: { name: "big" }, state: {},
    datasets: [{ id: "d", columns: [{ key: "v" }], rows: Array.from({ length: 500 }, (_, i) => ({ v: "repeat_value_" + (i % 5) })) }] };
  const raw = SL.encodeRaw(big);
  const deflated = zlib.deflateRawSync(Buffer.from(JSON.stringify(big), "utf8"));
  const zPayload = "z" + SL.bytesToBase64url(new Uint8Array(deflated));
  assert.ok(zPayload.length < raw.length, `compressed (${zPayload.length}) < raw (${raw.length})`);
});

test("decodePayload rejects bad input", () => {
  assert.throws(() => SL.decodePayload(""), /Empty/);
  assert.throws(() => SL.decodePayload("xNOTVALID"), /Unknown share codec tag/);
  assert.throws(() => SL.decodePayload("z" + SL.bytesToBase64url(new Uint8Array([1, 2, 3]))), /requires an inflate/);
  // 'r' tag but corrupt JSON bytes
  const badJson = "r" + SL.bytesToBase64url(new TextEncoder().encode("{not json"));
  assert.throws(() => SL.decodePayload(badJson), /Corrupt share payload/);
});

test("MAX_PAYLOAD_CHARS guard is exposed and sane", () => {
  assert.equal(typeof SL.MAX_PAYLOAD_CHARS, "number");
  assert.ok(SL.MAX_PAYLOAD_CHARS >= 16000 && SL.MAX_PAYLOAD_CHARS <= 100000);
});
