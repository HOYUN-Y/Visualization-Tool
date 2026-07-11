(function () {
  "use strict";

  // ---- helpers -----------------------------------------------------------

  function isMissing(v) {
    if (v === null || v === undefined || v === "") return true;
    const n = typeof v === "number" ? v : Number(v);
    return !Number.isFinite(n);
  }

  function toNumber(v) {
    return typeof v === "number" ? v : Number(v);
  }

  // Extract a numeric matrix for the given keys, dropping any row that has a
  // missing/non-numeric value in any selected key.
  function extractMatrix(rows, keys) {
    const out = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let ok = true;
      const vec = new Array(keys.length);
      for (let c = 0; c < keys.length; c++) {
        const v = row ? row[keys[c]] : undefined;
        if (isMissing(v)) {
          ok = false;
          break;
        }
        vec[c] = toNumber(v);
      }
      if (ok) out.push(vec);
    }
    return out;
  }

  // Jacobi eigenvalue algorithm for a real symmetric matrix.
  // Returns { values:[...], vectors:[[...]] } where vectors[k] is the k-th
  // eigenvector (a column of V) as an array. Deterministic.
  function jacobiEigen(Ain, maxSweeps, threshold) {
    const n = Ain.length;
    // Copy A so we don't mutate the input.
    const A = Ain.map(function (row) {
      return row.slice();
    });
    // V starts as identity.
    const V = [];
    for (let i = 0; i < n; i++) {
      V.push(new Array(n).fill(0));
      V[i][i] = 1;
    }

    function offDiagNorm() {
      let s = 0;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          s += A[p][q] * A[p][q];
        }
      }
      return Math.sqrt(2 * s);
    }

    const eps = threshold || 1e-12;
    const sweeps = maxSweeps || 100;

    for (let sweep = 0; sweep < sweeps; sweep++) {
      if (offDiagNorm() <= eps) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = A[p][q];
          if (Math.abs(apq) <= eps) continue;
          const app = A[p][p];
          const aqq = A[q][q];
          // Compute rotation angle.
          const phi = (aqq - app) / (2 * apq);
          let t;
          if (phi === 0) {
            t = 1;
          } else {
            const sign = phi > 0 ? 1 : -1;
            t = sign / (Math.abs(phi) + Math.sqrt(phi * phi + 1));
          }
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;

          // Apply rotation to A.
          for (let k = 0; k < n; k++) {
            const akp = A[k][p];
            const akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p][k];
            const aqk = A[q][k];
            A[p][k] = c * apk - s * aqk;
            A[q][k] = s * apk + c * aqk;
          }
          // Accumulate rotation into V.
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p];
            const vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }

    const values = new Array(n);
    for (let i = 0; i < n; i++) values[i] = A[i][i];

    // Eigenvectors are columns of V.
    const vectors = new Array(n);
    for (let k = 0; k < n; k++) {
      const vec = new Array(n);
      for (let i = 0; i < n; i++) vec[i] = V[i][k];
      vectors[k] = vec;
    }
    return { values: values, vectors: vectors };
  }

  // ---- public API --------------------------------------------------------

  function fit(rows, keys, options) {
    if (!Array.isArray(keys) || keys.length < 2) {
      throw new Error("PCA.fit: requires at least 2 keys");
    }
    const opts = options || {};
    const standardize = opts.standardize !== false; // default true

    const X = extractMatrix(rows || [], keys);
    const n = X.length;
    if (n < 2) {
      throw new Error("PCA.fit: requires at least 2 complete rows");
    }
    const p = keys.length;

    // Column means.
    const mean = new Array(p).fill(0);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < p; c++) mean[c] += X[r][c];
    }
    for (let c = 0; c < p; c++) mean[c] /= n;

    // Column sample std (ddof = 1).
    const std = new Array(p).fill(0);
    for (let c = 0; c < p; c++) {
      let s = 0;
      for (let r = 0; r < n; r++) {
        const d = X[r][c] - mean[c];
        s += d * d;
      }
      std[c] = Math.sqrt(s / (n - 1));
    }

    // Centered (and optionally scaled) matrix Z.
    const Z = new Array(n);
    for (let r = 0; r < n; r++) {
      const zr = new Array(p);
      for (let c = 0; c < p; c++) {
        let d = X[r][c] - mean[c];
        if (standardize) {
          d = std[c] > 0 ? d / std[c] : 0;
        }
        zr[c] = d;
      }
      Z[r] = zr;
    }

    // Covariance (or correlation) matrix: (1/(n-1)) Z^T Z.
    const cov = [];
    for (let i = 0; i < p; i++) cov.push(new Array(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = i; j < p; j++) {
        let s = 0;
        for (let r = 0; r < n; r++) s += Z[r][i] * Z[r][j];
        s /= n - 1;
        cov[i][j] = s;
        cov[j][i] = s;
      }
    }

    // Eigen-decomposition.
    const eig = jacobiEigen(cov, 100, 1e-12);

    // Pair up and sort by eigenvalue descending.
    const pairs = [];
    for (let k = 0; k < p; k++) {
      pairs.push({ value: eig.values[k], vector: eig.vectors[k] });
    }
    pairs.sort(function (a, b) {
      return b.value - a.value;
    });

    const eigenvalues = new Array(p);
    const components = new Array(p);
    for (let k = 0; k < p; k++) {
      let ev = pairs[k].value;
      if (ev < 0 && ev > -1e-12) ev = 0; // clamp tiny negatives
      eigenvalues[k] = ev;

      // Normalize eigenvector to unit length and fix sign convention:
      // make the element of largest absolute value positive.
      const vec = pairs[k].vector.slice();
      let norm = 0;
      for (let i = 0; i < p; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let i = 0; i < p; i++) vec[i] /= norm;
      }
      let maxI = 0;
      let maxAbs = -1;
      for (let i = 0; i < p; i++) {
        if (Math.abs(vec[i]) > maxAbs) {
          maxAbs = Math.abs(vec[i]);
          maxI = i;
        }
      }
      if (vec[maxI] < 0) {
        for (let i = 0; i < p; i++) vec[i] = -vec[i];
      }
      components[k] = vec;
    }

    // Explained variance & ratio.
    let total = 0;
    for (let k = 0; k < p; k++) total += eigenvalues[k];
    const explainedVariance = eigenvalues.slice();
    const explainedRatio = new Array(p);
    for (let k = 0; k < p; k++) {
      explainedRatio[k] = total > 0 ? eigenvalues[k] / total : 0;
    }

    // Scores: project each centered/scaled row onto all PCs.
    const scores = new Array(n);
    for (let r = 0; r < n; r++) {
      const sr = new Array(p);
      for (let k = 0; k < p; k++) {
        let s = 0;
        const comp = components[k];
        for (let c = 0; c < p; c++) s += Z[r][c] * comp[c];
        sr[k] = s;
      }
      scores[r] = sr;
    }

    return {
      keys: keys.slice(),
      n: n,
      mean: mean,
      std: std,
      eigenvalues: eigenvalues,
      components: components,
      explainedVariance: explainedVariance,
      explainedRatio: explainedRatio,
      scores: scores
    };
  }

  function scree(result) {
    const out = [];
    let cum = 0;
    for (let k = 0; k < result.eigenvalues.length; k++) {
      cum += result.explainedRatio[k];
      out.push({
        pc: k + 1,
        eigenvalue: result.eigenvalues[k],
        ratio: result.explainedRatio[k],
        cumulative: cum
      });
    }
    return out;
  }

  function biplot(result, i, j) {
    const pi = i || 0;
    const pj = j === undefined ? 1 : j;

    const points = new Array(result.scores.length);
    for (let r = 0; r < result.scores.length; r++) {
      points[r] = [result.scores[r][pi], result.scores[r][pj]];
    }

    const si = Math.sqrt(Math.max(0, result.eigenvalues[pi]));
    const sj = Math.sqrt(Math.max(0, result.eigenvalues[pj]));
    const loadings = new Array(result.keys.length);
    for (let c = 0; c < result.keys.length; c++) {
      loadings[c] = {
        key: result.keys[c],
        x: result.components[pi][c] * si,
        y: result.components[pj][c] * sj
      };
    }
    return { points: points, loadings: loadings };
  }

  const api = { fit: fit, scree: scree, biplot: biplot };

  if (typeof window !== "undefined") window.PCA = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
