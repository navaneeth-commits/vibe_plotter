import {
  CorrelationPair,
  CorrelationStrength,
  CrossFileCompatibility,
  DatasetProfile,
  GroupRelationship,
  JoinKeyMapping,
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

  // If variance is zero in either variable, correlation is mathematically undefined
  if (xDenom <= 1e-12 || yDenom <= 1e-12) {
    return null;
  }

  const denom = Math.sqrt(xDenom) * Math.sqrt(yDenom);
  if (denom <= 1e-12 || !Number.isFinite(denom)) {
    return null;
  }

  const r = numerator / denom;
  if (!Number.isFinite(r) || Number.isNaN(r)) {
    return null;
  }

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

function parseNumeric(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "number") return (isNaN(v) || !isFinite(v)) ? null : v;
  if (typeof v === "string") {
    const cleaned = v.trim().replace(/[$€£¥%]/g, "").replace(/,/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return (isNaN(n) || !isFinite(n)) ? null : n;
  }
  return null;
}

const PLACEHOLDER_TOKENS = new Set([
  "", "n/a", "na", "null", "none", "unknown", "-", ".", "undefined", "other"
]);

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
        const n1 = parseNumeric(row[col1]);
        const n2 = parseNumeric(row[col2]);
        if (n1 !== null && n2 !== null) {
          pairedX.push(n1);
          pairedY.push(n2);
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

  const joinKeyMappings: JoinKeyMapping[] = [];

  // Helper to test if values look like generic boolean / binary flags rather than real entity keys
  const isBinaryFlag = (vals: Set<string>): boolean => {
    if (vals.size !== 2) return false;
    const arr = Array.from(vals);
    const flags = new Set(["true", "false", "yes", "no", "0", "1", "y", "n"]);
    return arr.every((v) => flags.has(v));
  };

  // Helper to extract clean non-placeholder value set
  const extractCleanSet = (rows: Record<string, any>[], colName: string): Set<string> => {
    return new Set(
      rows
        .map((r) => String(r[colName] !== undefined && r[colName] !== null ? r[colName] : "").trim().toLowerCase())
        .filter((s) => s.length > 0 && !PLACEHOLDER_TOKENS.has(s))
    );
  };

  // 1. Evaluate Date / Temporal Columns (same name or different name)
  const dates1 = cols1.filter((c) => c.inferredType === "date");
  const dates2 = cols2.filter((c) => c.inferredType === "date");

  for (const d1 of dates1) {
    for (const d2 of dates2) {
      const set1 = extractCleanSet(rows1, d1.name);
      const set2 = extractCleanSet(rows2, d2.name);
      if (set1.size === 0 || set2.size === 0) continue;

      let sharedDates = 0;
      set1.forEach((val) => {
        if (set2.has(val)) sharedDates++;
      });

      const minCardinality = Math.min(set1.size, set2.size);
      const overlapRatio = minCardinality > 0 ? sharedDates / minCardinality : 0;

      // Meaningful temporal alignment: at least 2 overlapping periods and meaningful overlap ratio
      const isMeaningful =
        sharedDates >= 2 &&
        (minCardinality <= 3 ? overlapRatio >= 0.5 : overlapRatio >= 0.35);

      if (isMeaningful) {
        joinKeyMappings.push({
          primaryKey: d1.name,
          secondaryKey: d2.name,
          matchType: "date",
          sharedValuesCount: sharedDates,
          overlapRatio,
        });
      }
    }
  }

  // 2. Evaluate ID and Categorical Key Columns (same name or different name)
  const keys1 = cols1.filter((c) => c.inferredType === "id" || c.inferredType === "category");
  const keys2 = cols2.filter((c) => c.inferredType === "id" || c.inferredType === "category");

  for (const k1 of keys1) {
    for (const k2 of keys2) {
      // Avoid re-evaluating date pairs already matched
      if (joinKeyMappings.some((m) => m.primaryKey === k1.name && m.secondaryKey === k2.name)) {
        continue;
      }

      const isSameName = k1.name.toLowerCase().trim() === k2.name.toLowerCase().trim();

      const set1 = extractCleanSet(rows1, k1.name);
      const set2 = extractCleanSet(rows2, k2.name);

      // Key candidates must have cardinality >= 2 and cannot be binary boolean flags
      if (set1.size < 2 || set2.size < 2 || isBinaryFlag(set1) || isBinaryFlag(set2)) {
        continue;
      }

      let sharedCount = 0;
      set1.forEach((val) => {
        if (set2.has(val)) sharedCount++;
      });

      const minCardinality = Math.min(set1.size, set2.size);
      const overlapRatio = minCardinality > 0 ? sharedCount / minCardinality : 0;

      let isMeaningful = false;
      if (isSameName) {
        // Same column name: require at least 2 shared keys and >= 35% overlap (or >= 50% for small sets)
        isMeaningful =
          sharedCount >= 2 &&
          (minCardinality <= 4 ? overlapRatio >= 0.5 : overlapRatio >= 0.35);
      } else {
        // Different column names: require stronger signal (>= 3 shared keys and >= 50% overlap)
        isMeaningful = sharedCount >= 3 && overlapRatio >= 0.5;
      }

      if (isMeaningful) {
        const matchType = k1.inferredType === "id" || k2.inferredType === "id" ? "id" : "category";
        joinKeyMappings.push({
          primaryKey: k1.name,
          secondaryKey: k2.name,
          matchType,
          sharedValuesCount: sharedCount,
          overlapRatio,
        });
      }
    }
  }

  // Sort mappings: exact name match first, then dates, then higher overlap ratio
  joinKeyMappings.sort((a, b) => {
    const aSame = a.primaryKey.toLowerCase().trim() === a.secondaryKey.toLowerCase().trim() ? 1 : 0;
    const bSame = b.primaryKey.toLowerCase().trim() === b.secondaryKey.toLowerCase().trim() ? 1 : 0;
    if (aSame !== bSame) return bSame - aSame;
    if (a.matchType === "date" && b.matchType !== "date") return -1;
    if (b.matchType === "date" && a.matchType !== "date") return 1;
    return (b.overlapRatio || 0) - (a.overlapRatio || 0);
  });

  const isCompatible = joinKeyMappings.length > 0;
  const bestMapping = isCompatible ? joinKeyMappings[0] : null;

  const commonKeyCandidates = joinKeyMappings.map((m) =>
    m.primaryKey === m.secondaryKey ? m.primaryKey : `${m.primaryKey} ↔ ${m.secondaryKey}`
  );

  const compatibleDateColumns = joinKeyMappings
    .filter((m) => m.matchType === "date")
    .map((m) => (m.primaryKey === m.secondaryKey ? m.primaryKey : `${m.primaryKey} ↔ ${m.secondaryKey}`));

  return {
    compatible: isCompatible,
    file1Index,
    file2Index,
    file1Name: p1.fileName,
    file2Name: p2.fileName,
    commonColumns,
    commonKeyCandidates,
    compatibleDateColumns,
    primaryKey: bestMapping?.primaryKey,
    secondaryKey: bestMapping?.secondaryKey,
    joinKeyMappings,
    reason: isCompatible
      ? `Compatible via verified key: '${bestMapping!.primaryKey}' in '${p1.fileName}' ↔ '${bestMapping!.secondaryKey}' in '${p2.fileName}' (${bestMapping!.sharedValuesCount} shared values, ${(bestMapping!.overlapRatio! * 100).toFixed(0)}% overlap).`
      : "No reliable cross-file relationship or common join key was detected between these datasets.",
  };
}
