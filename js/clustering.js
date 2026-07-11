/* insight Analytics — pure clustering engine (window.Clustering)
   Agglomerative hierarchical (single/complete/average/ward) + DBSCAN.
   Deterministic, no external deps. Practical to ~5k rows (O(n^2)). */
(function () {
  "use strict";

  const num = (v) => (v == null || v === "" || isNaN(v) ? null : Number(v));

  // Extract standardized numeric matrix for keys; drop rows with any missing.
  function matrix(rows, keys, standardize) {
    const raw = [], idx = [];
    rows.forEach((r, i) => {
      const vec = keys.map((k) => num(r[k]));
      if (vec.every((v) => v != null)) { raw.push(vec); idx.push(i); }
    });
    if (standardize !== false && raw.length) {
      for (let c = 0; c < keys.length; c++) {
        const col = raw.map((v) => v[c]);
        const m = col.reduce((s, v) => s + v, 0) / col.length;
        const sd = Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, col.length - 1)) || 1;
        raw.forEach((v) => { v[c] = (v[c] - m) / sd; });
      }
    }
    return { data: raw, sourceIndex: idx };
  }

  const dist2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };
  const dist = (a, b) => Math.sqrt(dist2(a, b));

  // ── DBSCAN ─────────────────────────────────────────────────────────
  function dbscan(rows, keys, options) {
    options = options || {};
    const eps = options.eps == null ? 0.5 : options.eps;
    const minPts = options.minPts == null ? 4 : options.minPts;
    const { data, sourceIndex } = matrix(rows, keys, options.standardize);
    const n = data.length;
    const labels = new Array(n).fill(undefined); // undefined=unvisited, -1=noise, >=0 cluster
    const region = (p) => { const out = []; for (let q = 0; q < n; q++) if (dist(data[p], data[q]) <= eps) out.push(q); return out; };
    let cid = -1;
    for (let p = 0; p < n; p++) {
      if (labels[p] !== undefined) continue;
      const neighbors = region(p);
      if (neighbors.length < minPts) { labels[p] = -1; continue; }
      cid++; labels[p] = cid;
      const seeds = neighbors.filter((q) => q !== p);
      for (let i = 0; i < seeds.length; i++) {
        const q = seeds[i];
        if (labels[q] === -1) labels[q] = cid;      // border point
        if (labels[q] !== undefined) continue;
        labels[q] = cid;
        const qn = region(q);
        if (qn.length >= minPts) for (const nb of qn) if (!seeds.includes(nb)) seeds.push(nb);
      }
    }
    return { labels, sourceIndex, clusters: cid + 1, noise: labels.filter((l) => l === -1).length };
  }

  // ── Agglomerative hierarchical ─────────────────────────────────────
  // Lance-Williams for single/complete/average/ward.
  function hierarchical(rows, keys, options) {
    options = options || {};
    const method = options.method || "average";
    const { data, sourceIndex } = matrix(rows, keys, options.standardize);
    const n = data.length;
    if (n < 2) throw new Error("Hierarchical clustering needs >= 2 rows");

    // active clusters
    const active = [];
    for (let i = 0; i < n; i++) active.push({ id: i, members: [i], size: 1 });
    const D = {}; // pairwise distances keyed "i,j" (i<j) among active ids
    const key = (a, b) => a < b ? a + "," + b : b + "," + a;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[key(i, j)] = method === "ward" ? dist2(data[i], data[j]) : dist(data[i], data[j]);

    const merges = [];
    let nextId = n;
    const sizeOf = {}; active.forEach((c) => { sizeOf[c.id] = 1; });

    while (active.length > 1) {
      // find closest pair
      let best = Infinity, bi = 0, bj = 1;
      for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
        const d = D[key(active[a].id, active[b].id)];
        if (d < best) { best = d; bi = a; bj = b; }
      }
      const ca = active[bi], cb = active[bj];
      const merged = { id: nextId, members: ca.members.concat(cb.members), size: ca.size + cb.size };
      merges.push({ a: ca.id, b: cb.id, dist: method === "ward" ? Math.sqrt(best) : best, size: merged.size });
      sizeOf[nextId] = merged.size;

      // Lance-Williams update distance from merged to each other active k
      for (const ck of active) {
        if (ck === ca || ck === cb) continue;
        const dak = D[key(ca.id, ck.id)], dbk = D[key(cb.id, ck.id)];
        let dnew;
        if (method === "single") dnew = Math.min(dak, dbk);
        else if (method === "complete") dnew = Math.max(dak, dbk);
        else if (method === "ward") {
          const si = ca.size, sj = cb.size, sk = ck.size;
          const t = si + sj + sk;
          dnew = ((si + sk) * dak + (sj + sk) * dbk - sk * best) / t;
        } else { // average
          dnew = (ca.size * dak + cb.size * dbk) / (ca.size + cb.size);
        }
        D[key(nextId, ck.id)] = dnew;
      }
      active.splice(bj, 1); active.splice(bi, 1);
      active.push(merged);
      nextId++;
    }

    // cut into k flat clusters
    function labelsAt(k) {
      // rebuild clusters by replaying merges until (n - k) merges done
      const parent = {}; for (let i = 0; i < n; i++) parent[i] = i;
      const find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
      // clamp k to [1, n]: k<1 would replay more merges than exist (merges.length === n-1) and crash.
      const stop = Math.max(0, Math.min(merges.length, n - k));
      for (let m = 0; m < stop; m++) { const { a, b } = merges[m]; // a,b are cluster ids at that time; map through members
        // union first members of each side
        const rootA = find(memberRep(a)); const rootB = find(memberRep(b));
        parent[rootB] = rootA;
      }
      const roots = {}; let c = 0; const labels = new Array(n);
      for (let i = 0; i < n; i++) { const r = find(i); if (!(r in roots)) roots[r] = c++; labels[i] = roots[r]; }
      return labels;
    }
    // helper: representative original point of a cluster id
    const repCache = {};
    function memberRep(id) {
      if (id < n) return id;
      if (repCache[id] != null) return repCache[id];
      const m = merges[id - n];
      const r = memberRep(m.a);
      repCache[id] = r; return r;
    }

    return { n, merges, sourceIndex, labelsAt };
  }

  const api = { dbscan, hierarchical, dist, matrix };
  if (typeof window !== "undefined") window.Clustering = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
