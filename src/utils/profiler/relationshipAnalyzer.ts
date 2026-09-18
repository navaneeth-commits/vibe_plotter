import {
  CorrelationPair,
  CorrelationStrength,
  CrossFileCompatibility,
  DatasetProfile,
  GroupRelationship,
  TemporalRelationship,
} from "./types";
import { parseDateToTime, isNilOrEmpty } from "./statisticalProfiler";

/**
 * Computes Pearson correlation coefficient between two numeric arrays.
 */
export function computePearsonCorrelation(
  xVals: number[],
  yVals: number[]
): { r: number; n: number } | null {
  if (xVals.length !== yVals.length || xVals.length < 3) {
    return null;
  }

  const n = xVals.length;
  const xMean = xVals.reduce((acc, v) => acc + v, 0) / n;
  const yMean = yVals.reduce((acc, v) => acc + v, 0) / n;

  let numerator = 0;
  let xDenom = 0;
  let yDenom = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xVals[i] - xMean;
    const yDiff = yVals[i] - yMean;
    numerator += xDiff * yDiff;
    xDenom += xDiff * xDiff;
    yDenom += yDiff * yDiff;
  }

  if (xDenom <= 0 || yDenom <= 0) {
    return { r: 0, n };
  }

  const r = numerator / (Math.sqrt(xDenom) * Math.sqrt(yDenom));
  const clamped = Math.max(-1, Math.min(1, r));
  return { r: Math.round(clamped * 1000) / 1000, n };
}

/**
 * Assigns fractional ranks to an array of numbers, handling ties.
 */
export function rankArray(arr: number[]): number[] {
  const indexed = arr.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);

  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].val === indexed[j].val) {
      j++;
    }
    const tieCount = j - i + 1;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Computes Spearman rank correlation coefficient.
 */
export function computeSpearmanCorrelation(
  xVals: number[],
  yVals: number[]
): { r: number; n: number } | null {
  if (xVals.length !== yVals.length || xVals.length < 3) return null;
  const xRanks = rankArray(xVals);
  const yRanks = rankArray(yVals);
  return computePearsonCorrelation(xRanks, yRanks);
}

/**
 * Classifies Pearson correlation strength with precise descriptive wording.
 */
export function classifyCorrelation(r: number): {
  strength: CorrelationStrength;
  description: string;
} {
  const sign = r >= 0 ? "+" : "";
  const formattedR = `${sign}${r.toFixed(2)}`;

  if (r >= 0.7) {
    return {
      strength: "strong_positive",
      description: `Strong positive linear association (r = ${formattedR})`,
    };
  }
  if (r >= 0.4) {
    return {
      strength: "moderate_positive",
      description: `Moderate positive linear association (r = ${formattedR})`,
    };
  }
  if (r > -0.4) {
    return {
      strength: "weak",
      description: `Weak or negligible linear association (r = ${formattedR})`,
    };
  }
  if (r > -0.7) {
    return {
      strength: "moderate_negative",
      description: `Moderate negative linear association (r = ${formattedR})`,
    };
  }
  return {
    strength: "strong_negative",
    description: `Strong negative linear association (r = ${formattedR})`,
  };
}

/**
 * Analyzes all pairwise correlations within a single dataset.
 */
export function analyzeCorrelations(
  rows: Record<string, any>[],
  numericColNames: string[]
): CorrelationPair[] {
  const results: CorrelationPair[] = [];
  if (numericColNames.length < 2 || rows.length < 3) return results;

  for (let i = 0; i < numericColNames.length; i++) {
    for (let j = i + 1; j < numericColNames.length; j++) {
      const col1 = numericColNames[i];
      const col2 = numericColNames[j];

      const pairedX: number[] = [];
      const pairedY: number[] = [];

      for (const row of rows) {
        const v1 = row[col1];
        const v2 = row[col2];
        if (
          !isNilOrEmpty(v1) &&
          !isNilOrEmpty(v2) &&
          typeof Number(v1) === "number" &&
          !isNaN(Number(v1)) &&
          typeof Number(v2) === "number" &&
          !isNaN(Number(v2))
        ) {
          pairedX.push(Number(v1));
          pairedY.push(Number(v2));
        }
      }

      if (pairedX.length >= 3) {
        const pearson = computePearsonCorrelation(pairedX, pairedY);
        if (pearson) {
          const spearman = computeSpearmanCorrelation(pairedX, pairedY);
          const { strength, description } = classifyCorrelation(pearson.r);
          results.push({
            col1,
            col2,
            pearsonR: pearson.r,
            spearmanR: spearman?.r,
            sampleSize: pearson.n,
            strength,
            description: `${col1} & ${col2}: ${description}`,
          });
        }
      }
    }
  }

  // Sort by absolute correlation strength descending
  return results.sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
}

/**
 * Analyzes relationships between categorical dimensions and numeric metrics.
 */
export function analyzeGroupRelationships(
  rows: Record<string, any>[],
  categoryCols: string[],
  numericCols: string[]
): GroupRelationship[] {
  const results: GroupRelationship[] = [];

  for (const catCol of categoryCols) {
    for (const numCol of numericCols) {
      const groups = new Map<string, number[]>();

      for (const row of rows) {
        const catVal = row[catCol];
        const numVal = row[numCol];
        if (
          !isNilOrEmpty(catVal) &&
          !isNilOrEmpty(numVal) &&
          !isNaN(Number(numVal))
        ) {
          const catStr = String(catVal).trim();
          if (!groups.has(catStr)) groups.set(catStr, []);
          groups.get(catStr)!.push(Number(numVal));
        }
      }

      // Meaningful grouping has 2 to 12 distinct categories with multiple samples
      if (groups.size >= 2 && groups.size <= 12) {
        let totalCount = 0;
        groups.forEach((vals) => (totalCount += vals.length));

        if (totalCount >= 4) {
          results.push({
            categoryCol: catCol,
            numericCol: numCol,
            groupCount: groups.size,
            description: `${numCol} varies across ${groups.size} segments of ${catCol}`,
          });
        }
      }
    }
  }

  return results.slice(0, 5);
}

/**
 * Analyzes temporal trends across chronological numeric metrics.
 */
export function analyzeTemporalRelationships(
  rows: Record<string, any>[],
  dateCols: string[],
  numericCols: string[]
): TemporalRelationship[] {
  const results: TemporalRelationship[] = [];

  for (const dateCol of dateCols) {
    // Sort rows by date
    const parsedRows = rows
      .map((r) => ({
        time: parseDateToTime(r[dateCol]),
        row: r,
      }))
      .filter((item): item is { time: number; row: Record<string, any> } => item.time !== null)
      .sort((a, b) => a.time - b.time);

    if (parsedRows.length < 3) continue;

    for (const numCol of numericCols) {
      const timeIndices: number[] = [];
      const numValues: number[] = [];

      parsedRows.forEach((item, index) => {
        const v = item.row[numCol];
        if (!isNilOrEmpty(v) && !isNaN(Number(v))) {
          timeIndices.push(index);
          numValues.push(Number(v));
        }
      });

      if (timeIndices.length >= 3) {
        const correlation = computePearsonCorrelation(timeIndices, numValues);
        if (correlation) {
          let trend: TemporalRelationship["trend"] = "stable";
          if (correlation.r >= 0.6) trend = "increasing";
          else if (correlation.r <= -0.6) trend = "decreasing";
          else if (Math.abs(correlation.r) < 0.25) trend = "stable";
          else trend = "fluctuating";

          results.push({
            dateCol,
            numericCol: numCol,
            trend,
            description: `${numCol} displays an ${trend} trend across ${dateCol} (trend r = ${correlation.r.toFixed(2)})`,
          });
        }
      }
    }
  }

  return results.slice(0, 5);
}

/**
 * Analyzes schema compatibility and common join keys between two datasets.
 */
export function analyzeCrossFileCompatibility(
  p1: DatasetProfile,
  p2: DatasetProfile,
  rows1: Record<string, any>[],
  rows2: Record<string, any>[],
  file1Index: number,
  file2Index: number
): CrossFileCompatibility {
  const cols1 = p1.columns;
  const cols2 = p2.columns;

  const names1 = cols1.map((c) => c.name.toLowerCase().trim());
  const names2 = cols2.map((c) => c.name.toLowerCase().trim());

  // Find overlapping column names
  const commonColumns: string[] = [];
  cols1.forEach((c1) => {
    const matched = cols2.find(
      (c2) => c2.name.toLowerCase().trim() === c1.name.toLowerCase().trim()
    );
    if (matched) {
      commonColumns.push(c1.name);
    }
  });

  // Check for common key candidates (ID, Date, or Shared Category)
  const commonKeyCandidates: string[] = [];
  const compatibleDateColumns: string[] = [];

  for (const colName of commonColumns) {
    const c1 = cols1.find((c) => c.name.toLowerCase().trim() === colName.toLowerCase().trim())!;
    const c2 = cols2.find((c) => c.name.toLowerCase().trim() === colName.toLowerCase().trim())!;

    // Check date compatibility
    if (c1.inferredType === "date" && c2.inferredType === "date") {
      compatibleDateColumns.push(c1.name);
      commonKeyCandidates.push(c1.name);
      continue;
    }

    // Check shared categorical or identifier column with overlapping values
    if (
      (c1.inferredType === "category" || c1.inferredType === "id") &&
      (c2.inferredType === "category" || c2.inferredType === "id")
    ) {
      const vals1 = new Set(rows1.map((r) => String(r[c1.name] || "").trim()).filter(Boolean));
      const vals2 = new Set(rows2.map((r) => String(r[c2.name] || "").trim()).filter(Boolean));

      let sharedCount = 0;
      vals1.forEach((v) => {
        if (vals2.has(v)) sharedCount++;
      });

      if (sharedCount > 0) {
        commonKeyCandidates.push(c1.name);
      }
    }
  }

  // Also check if date columns have different names but both have dates (e.g. "Quarter" and "Quarter" or "Date" and "Period")
  if (compatibleDateColumns.length === 0) {
    const dates1 = cols1.filter((c) => c.inferredType === "date");
    const dates2 = cols2.filter((c) => c.inferredType === "date");
    if (dates1.length > 0 && dates2.length > 0) {
      // Check if they share at least one value
      const sample1 = new Set(rows1.map((r) => String(r[dates1[0].name] || "").trim()));
      const sample2 = new Set(rows2.map((r) => String(r[dates2[0].name] || "").trim()));
      let sharedDates = 0;
      sample1.forEach((d) => {
        if (sample2.has(d)) sharedDates++;
      });
      if (sharedDates > 0) {
        compatibleDateColumns.push(`${dates1[0].name} ~ ${dates2[0].name}`);
        commonKeyCandidates.push(`${dates1[0].name} ~ ${dates2[0].name}`);
      }
    }
  }

  const isCompatible = commonKeyCandidates.length > 0;

  return {
    compatible: isCompatible,
    file1Index,
    file2Index,
    file1Name: p1.fileName,
    file2Name: p2.fileName,
    commonColumns,
    commonKeyCandidates,
    compatibleDateColumns,
    reason: isCompatible
      ? `Compatible via common key / dimension: ${commonKeyCandidates.join(", ")}.`
      : "No reliable cross-file relationship or common join key was detected between these datasets.",
  };
}
