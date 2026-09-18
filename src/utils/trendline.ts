import { cleanNumber } from "./chartDataProcessor";

export type TrendlineType = "none" | "linear" | "polynomial";

export interface TrendlineResult {
  type: "linear" | "polynomial";
  equation: string;
  r2: number;
  predict: (x: number) => number;
  coefficients: number[]; // [intercept, slope] for linear; [c, b, a] for quadratic
  slope?: number;
  intercept?: number;
}

/**
 * Extracts and filters strictly valid numeric points (ignoring nulls, undefined, NaN, and non-numeric strings).
 * Supports both array of {x, y} objects and raw table rows with custom keys.
 */
export function extractValidNumericPoints(
  rawPoints: any[],
  xKey?: string,
  yKey?: string
): { x: number; y: number }[] {
  const valid: { x: number; y: number }[] = [];

  for (const pt of rawPoints) {
    const rawX = xKey !== undefined ? pt[xKey] : pt.x;
    const rawY = yKey !== undefined ? pt[yKey] : pt.y;

    const x = cleanNumber(rawX);
    const y = cleanNumber(rawY);

    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      valid.push({ x, y });
    }
  }

  return valid;
}

/**
 * Computes a linear trend line (y = mx + b) using Ordinary Least Squares (OLS).
 * Strictly calculates using only valid numeric points (ignoring nulls).
 */
export function calculateLinearTrendline(
  points: { x: number; y: number }[]
): TrendlineResult | null {
  if (!points || points.length < 2) return null;

  const n = points.length;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
  }
  for (let i = 0; i < n; i++) {
    sumY += points[i].y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  let ssXX = 0;
  let ssXY = 0;
  let ssYY = 0;

  for (let i = 0; i < n; i++) {
    const dx = points[i].x - meanX;
    const dy = points[i].y - meanY;
    ssXX += dx * dx;
    ssXY += dx * dy;
    ssYY += dy * dy;
  }

  // If variance in X is zero (vertical points), OLS slope is undefined
  if (ssXX <= 1e-12) {
    return null;
  }

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  // Compute R-squared
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * points[i].x + intercept;
    const err = points[i].y - pred;
    ssRes += err * err;
  }

  const r2 = ssYY > 1e-12 ? Math.max(0, Math.min(1, 1 - ssRes / ssYY)) : 1;

  const sign = intercept >= 0 ? "+" : "-";
  const absIntercept = Math.abs(intercept).toFixed(2);
  const eq = `y = ${slope.toFixed(2)}x ${sign} ${absIntercept}`;

  return {
    type: "linear",
    equation: eq,
    r2: Math.round(r2 * 1000) / 1000,
    predict: (x: number) => slope * x + intercept,
    coefficients: [intercept, slope],
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 10000) / 10000,
  };
}

/**
 * Computes a polynomial trend line (default degree 2: y = ax^2 + bx + c).
 * Uses standardized (centered and scaled) normal equations with Gaussian elimination
 * to ensure numerical stability and immunity to overflow.
 */
export function calculatePolynomialTrendline(
  points: { x: number; y: number }[],
  degree: number = 2
): TrendlineResult | null {
  if (!points || points.length === 0) return null;

  const n = points.length;
  // If not enough points for polynomial, fallback gracefully to linear
  if (n < degree + 1) {
    return calculateLinearTrendline(points);
  }

  // Compute mean and standard deviation of X for standardization
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let varX = 0;
  let ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - meanX;
    const dy = points[i].y - meanY;
    varX += dx * dx;
    ssYY += dy * dy;
  }

  if (varX <= 1e-12) {
    return calculateLinearTrendline(points);
  }

  const stdX = Math.sqrt(varX / n);

  // Standardized z_i = (x_i - meanX) / stdX
  const d = degree;
  const m = d + 1; // matrix dimension

  // Build matrix A and vector B for normal equations: A * alpha = B
  const A: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  const B: number[] = Array(m).fill(0);

  // Powers of z for each point
  for (let i = 0; i < n; i++) {
    const z = (points[i].x - meanX) / stdX;
    const y = points[i].y;

    const zPowers: number[] = [1];
    for (let p = 1; p <= 2 * d; p++) {
      zPowers.push(zPowers[p - 1] * z);
    }

    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) {
        A[r][c] += zPowers[r + c];
      }
      B[r] += y * zPowers[r];
    }
  }

  // Solve linear system A * alpha = B using Gaussian elimination with partial pivoting
  const alpha = solveLinearSystem(A, B);
  if (!alpha) {
    // If matrix singular, fallback to linear regression
    return calculateLinearTrendline(points);
  }

  // Predictor function using standardized z
  const predict = (x: number): number => {
    const z = (x - meanX) / stdX;
    let val = 0;
    let zPow = 1;
    for (let k = 0; k < m; k++) {
      val += alpha[k] * zPow;
      zPow *= z;
    }
    return val;
  };

  // Compute R2
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = predict(points[i].x);
    const err = points[i].y - pred;
    ssRes += err * err;
  }

  const r2 = ssYY > 1e-12 ? Math.max(0, Math.min(1, 1 - ssRes / ssYY)) : 1;

  // Convert coefficients to standard form y = a*x^2 + b*x + c for degree 2
  let equation = "";
  const standardCoeffs: number[] = [];

  if (d === 2) {
    // z = (x - meanX) / stdX
    // y = alpha[0] + alpha[1]*z + alpha[2]*z^2
    // z^2 = (x^2 - 2*meanX*x + meanX^2) / stdX^2
    const stdX2 = stdX * stdX;
    const a = alpha[2] / stdX2;
    const b = alpha[1] / stdX - (2 * alpha[2] * meanX) / stdX2;
    const c = alpha[0] - (alpha[1] * meanX) / stdX + (alpha[2] * meanX * meanX) / stdX2;

    standardCoeffs.push(c, b, a);

    const formatTerm = (num: number, powStr: string, isFirst: boolean) => {
      const sign = num >= 0 ? (isFirst ? "" : "+ ") : "- ";
      const absVal = Math.abs(num);
      return `${sign}${absVal.toFixed(2)}${powStr}`;
    };

    equation = `y = ${formatTerm(a, "x²", true)} ${formatTerm(b, "x", false)} ${formatTerm(c, "", false)}`;
  } else {
    equation = `Poly (deg ${d}, R² = ${r2.toFixed(2)})`;
    standardCoeffs.push(...alpha);
  }

  return {
    type: "polynomial",
    equation,
    r2: Math.round(r2 * 1000) / 1000,
    predict,
    coefficients: standardCoeffs,
  };
}

/**
 * Solves Ax = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    // Find pivot
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let r = k + 1; r < n; r++) {
      if (Math.abs(M[r][k]) > maxVal) {
        maxVal = Math.abs(M[r][k]);
        maxRow = r;
      }
    }

    if (maxVal <= 1e-14) {
      return null; // Singular or nearly singular
    }

    // Swap rows
    if (maxRow !== k) {
      const tmp = M[k];
      M[k] = M[maxRow];
      M[maxRow] = tmp;
    }

    // Eliminate
    for (let r = k + 1; r < n; r++) {
      const factor = M[r][k] / M[k][k];
      for (let c = k; c <= n; c++) {
        M[r][c] -= factor * M[k][c];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / M[r][r];
  }

  return x;
}

/**
 * Unified helper to calculate trendline based on requested type.
 */
export function calculateTrendline(
  points: { x: number; y: number }[],
  type: TrendlineType,
  polynomialOrder: number = 2
): TrendlineResult | null {
  if (type === "none") return null;
  if (type === "polynomial") {
    return calculatePolynomialTrendline(points, polynomialOrder);
  }
  return calculateLinearTrendline(points);
}
