import {
  ColumnProfile,
  ColumnType,
  DataQualityReport,
  DatasetProfile,
  DateStatistics,
  NumericStatistics,
  CategoricalStatistics,
} from "./types";

/**
 * Checks whether a value is null, undefined, NaN, or empty string.
 */
export function isNilOrEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "number" && isNaN(val)) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  return false;
}

/**
 * Robust date detection.
 */
export function isDateLike(val: unknown): boolean {
  if (val instanceof Date && !isNaN(val.getTime())) return true;
  if (typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length < 4 || trimmed.length > 40) return false;

  // Check Quarter pattern like 2023-Q1 or Q1 2023
  if (/^(\d{4}[-/ ]?Q[1-4]|Q[1-4][-/ ]?\d{4})$/i.test(trimmed)) return true;

  // Month-Year pattern like 2023-01 or Jan 2023
  if (/^\d{4}[-/](0[1-9]|1[0-2])$/.test(trimmed)) return true;

  // ISO or standard date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) {
    const timestamp = Date.parse(trimmed);
    return !isNaN(timestamp);
  }
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(trimmed)) {
    const timestamp = Date.parse(trimmed);
    return !isNaN(timestamp);
  }

  // Month name patterns like Jan 15, 2023 or 15 Jan 2023
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i.test(trimmed)) return true;
  if (/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i.test(trimmed)) return true;

  // Pure 4-digit year (1900-2099)
  if (/^(19|20)\d{2}$/.test(trimmed)) return true;

  return false;
}

/**
 * Normalizes date string or timestamp to milliseconds.
 */
export function parseDateToTime(val: unknown): number | null {
  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? null : t;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    // Quarter format like 2023-Q1
    const qMatch = trimmed.match(/^(\d{4})[-/ ]?Q([1-4])$/i);
    if (qMatch) {
      const year = parseInt(qMatch[1], 10);
      const quarter = parseInt(qMatch[2], 10);
      const month = (quarter - 1) * 3;
      return new Date(year, month, 1).getTime();
    }
    const parsed = Date.parse(trimmed);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof val === "number" && val > 1000000000 && val < 2500000000000) {
    return val;
  }
  return null;
}

/**
 * Quantile calculation on sorted numbers (linear interpolation).
 */
export function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Infer column type from non-empty values.
 */
export function inferColumnType(
  columnName: string,
  values: unknown[],
  rowCount: number
): ColumnType {
  const nonNull = values.filter((v) => !isNilOrEmpty(v));
  if (nonNull.length === 0) return "text";

  const nameLower = columnName.toLowerCase().trim();

  // Boolean check
  const booleanMatches = nonNull.filter((v) => {
    if (typeof v === "boolean") return true;
    if (typeof v === "string") {
      const s = v.toLowerCase().trim();
      return s === "true" || s === "false" || s === "yes" || s === "no" || s === "y" || s === "n";
    }
    return false;
  });
  if (booleanMatches.length / nonNull.length >= 0.9) {
    return "boolean";
  }

  // Date check
  const dateMatches = nonNull.filter((v) => isDateLike(v));
  if (dateMatches.length / nonNull.length >= 0.8) {
    return "date";
  }

  // Check for ZIP / Postal code patterns (e.g., 90210, 02138, SW1A 1AA)
  const isZipColumn =
    nameLower.includes("zip") ||
    nameLower.includes("postal") ||
    nameLower.includes("postcode") ||
    nameLower.includes("pincode");
  if (isZipColumn) {
    return "id";
  }

  // Numeric check
  const numericValues = nonNull.map((v) => {
    if (typeof v === "boolean") return null;
    if (typeof v === "number") return (isNaN(v) || !isFinite(v)) ? null : v;
    if (typeof v === "string") {
      const trimmed = v.trim();
      // Values with leading zeros like "00123" are codes/IDs, not continuous numbers
      if (/^0\d{2,}/.test(trimmed)) return null;
      const cleaned = trimmed.replace(/[$€£¥%]/g, "").replace(/,/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
      const num = Number(cleaned);
      return (isNaN(num) || !isFinite(num)) ? null : num;
    }
    return null;
  });

  const validNumbers = numericValues.filter((v): v is number => v !== null);
  const isMostlyNumeric = validNumbers.length / nonNull.length >= 0.85;

  if (isMostlyNumeric) {
    const uniqueNumCount = new Set(validNumbers).size;

    // Financial/metric keywords should never be mistakenly flagged as IDs
    const isExplicitFinancialOrMetric =
      nameLower.includes("amount") ||
      nameLower.includes("price") ||
      nameLower.includes("cost") ||
      nameLower.includes("revenue") ||
      nameLower.includes("salary") ||
      nameLower.includes("profit") ||
      nameLower.includes("rate") ||
      nameLower.includes("total") ||
      nameLower.includes("fee") ||
      nameLower.includes("score") ||
      nameLower.includes("weight") ||
      nameLower.includes("height") ||
      nameLower.includes("temp") ||
      nameLower.includes("count") ||
      nameLower.includes("quantity") ||
      nameLower.includes("sales") ||
      nameLower.includes("spend") ||
      nameLower.includes("budget");

    const isNamedLikeId =
      !isExplicitFinancialOrMetric &&
      (nameLower === "id" ||
        nameLower.startsWith("id_") ||
        nameLower.endsWith("_id") ||
        nameLower.endsWith(" id") ||
        nameLower === "uuid" ||
        nameLower === "guid" ||
        nameLower.includes("identifier") ||
        nameLower.endsWith("_code") ||
        (nameLower.endsWith("code") && !nameLower.includes("encode")) ||
        nameLower === "ssn" ||
        nameLower === "ein");

    // Sequential row index detection (e.g. 1, 2, 3, 4, ... N)
    const isIndexName =
      nameLower === "index" ||
      nameLower === "#" ||
      nameLower === "no" ||
      nameLower === "num" ||
      nameLower === "row" ||
      nameLower === "row_num";
    const isSequentialIndex =
      isIndexName &&
      uniqueNumCount === validNumbers.length &&
      validNumbers.length >= 3;

    if ((isNamedLikeId && uniqueNumCount / nonNull.length >= 0.7) || isSequentialIndex) {
      return "id";
    }

    return "numeric";
  }

  // ID check for strings
  const stringVals = nonNull.map((v) => String(v).trim());
  const uniqueCount = new Set(stringVals).size;
  const isNamedLikeId =
    nameLower === "id" ||
    nameLower.startsWith("id_") ||
    nameLower.endsWith("_id") ||
    nameLower.endsWith(" id") ||
    nameLower === "uuid" ||
    nameLower.includes("identifier");

  if (isNamedLikeId && uniqueCount / nonNull.length >= 0.7) {
    return "id";
  }

  // Category vs Text
  const uniquenessRatio = uniqueCount / nonNull.length;
  if (uniqueCount <= 40 || (uniquenessRatio <= 0.4 && uniqueCount <= 100)) {
    return "category";
  }

  return "text";
}

/**
 * Calculates detailed numeric statistics.
 * Defensively guards against NaN, Infinity, zero variance, and small sample sizes.
 */
export function computeNumericStatistics(
  rawValues: unknown[]
): NumericStatistics {
  const count = rawValues.length;
  const validNumbers: number[] = [];
  let nullCount = 0;

  for (const v of rawValues) {
    if (isNilOrEmpty(v) || typeof v === "boolean") {
      nullCount++;
      continue;
    }
    if (typeof v === "number") {
      if (!isNaN(v) && isFinite(v)) validNumbers.push(v);
      else nullCount++;
    } else if (typeof v === "string") {
      const cleaned = v.trim().replace(/[$€£¥%]/g, "").replace(/,/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") {
        nullCount++;
        continue;
      }
      const num = Number(cleaned);
      if (!isNaN(num) && isFinite(num)) validNumbers.push(num);
      else nullCount++;
    } else {
      nullCount++;
    }
  }

  const validCount = validNumbers.length;
  const nullPercentage = count > 0 ? (nullCount / count) * 100 : 0;

  if (validCount === 0) {
    return {
      count,
      validCount: 0,
      nullCount,
      nullPercentage: Math.round(nullPercentage * 10) / 10,
      min: 0,
      max: 0,
      mean: 0,
      sum: 0,
      median: 0,
      standardDeviation: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      zerosCount: 0,
      negativesCount: 0,
      possibleOutliersCount: 0,
      sampleOutliers: [],
      skewness: null,
    };
  }

  const sorted = [...validNumbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / validCount;

  const median = calculatePercentile(sorted, 0.5);
  const q1 = calculatePercentile(sorted, 0.25);
  const q3 = calculatePercentile(sorted, 0.75);
  const iqr = q3 - q1;

  // Sample variance and standard deviation
  let variance = 0;
  if (validCount > 1) {
    const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
    variance = squaredDiffs.reduce((a, b) => a + b, 0) / (validCount - 1);
  }
  const standardDeviation = Math.sqrt(Math.max(0, variance));

  // Robust IQR Outlier Detection:
  // Outliers require sufficient data (validCount >= 4) and non-zero IQR.
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const hasSufficientDataForOutliers = validCount >= 4 && iqr > 0.000001;
  const outliers = hasSufficientDataForOutliers
    ? sorted.filter((v) => v < lowerFence || v > upperFence)
    : [];

  // Zeros & Negatives
  const zerosCount = sorted.filter((v) => v === 0).length;
  const negativesCount = sorted.filter((v) => v < 0).length;

  // Skewness calculation (adjusted Fisher-Pearson standardized moment)
  let skewness: number | null = null;
  if (validCount >= 3 && standardDeviation > 0.000001) {
    const cubedDiffs = sorted.map((v) => Math.pow((v - mean) / standardDeviation, 3));
    const m3 = cubedDiffs.reduce((a, b) => a + b, 0);
    const skewVal = (validCount / ((validCount - 1) * (validCount - 2))) * m3;
    if (Number.isFinite(skewVal) && !Number.isNaN(skewVal)) {
      skewness = Math.round(skewVal * 1000) / 1000;
    }
  }

  const safeNum = (val: number): number => (Number.isFinite(val) && !Number.isNaN(val) ? val : 0);

  return {
    count,
    validCount,
    nullCount,
    nullPercentage: Math.round(safeNum(nullPercentage) * 10) / 10,
    min: Math.round(safeNum(min) * 1000) / 1000,
    max: Math.round(safeNum(max) * 1000) / 1000,
    mean: Math.round(safeNum(mean) * 1000) / 1000,
    sum: Math.round(safeNum(sum) * 1000) / 1000,
    median: Math.round(safeNum(median) * 1000) / 1000,
    standardDeviation: Math.round(safeNum(standardDeviation) * 1000) / 1000,
    q1: Math.round(safeNum(q1) * 1000) / 1000,
    q3: Math.round(safeNum(q3) * 1000) / 1000,
    iqr: Math.round(safeNum(iqr) * 1000) / 1000,
    zerosCount,
    negativesCount,
    possibleOutliersCount: outliers.length,
    sampleOutliers: outliers.slice(0, 5),
    skewness,
  };
}

/**
 * Calculates categorical distribution statistics.
 */
export function computeCategoricalStatistics(
  rawValues: unknown[]
): CategoricalStatistics {
  const count = rawValues.length;
  const freqMap: Map<string, number> = new Map();
  let nullCount = 0;

  for (const v of rawValues) {
    if (isNilOrEmpty(v)) {
      nullCount++;
      continue;
    }
    const s = String(v).trim();
    freqMap.set(s, (freqMap.get(s) || 0) + 1);
  }

  const validCount = count - nullCount;
  const uniqueCount = freqMap.size;
  const nullPercentage = count > 0 ? (nullCount / count) * 100 : 0;
  const uniquePercentage = validCount > 0 ? (uniqueCount / validCount) * 100 : 0;

  const sortedFreq = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, cnt]) => ({
      value,
      count: cnt,
      percentage: validCount > 0 ? Math.round((cnt / validCount) * 1000) / 10 : 0,
    }));

  return {
    count,
    validCount,
    nullCount,
    nullPercentage: Math.round(nullPercentage * 10) / 10,
    uniqueCount,
    uniquePercentage: Math.round(uniquePercentage * 10) / 10,
    topValues: sortedFreq.slice(0, 10),
    isBinary: uniqueCount === 2,
    mode: sortedFreq[0]?.value || null,
  };
}

/**
 * Calculates date and temporal distribution statistics.
 */
export function computeDateStatistics(
  rawValues: unknown[]
): DateStatistics {
  const count = rawValues.length;
  const timestamps: { original: string; time: number }[] = [];
  let nullCount = 0;

  for (const v of rawValues) {
    if (isNilOrEmpty(v)) {
      nullCount++;
      continue;
    }
    const t = parseDateToTime(v);
    if (t !== null) {
      timestamps.push({ original: String(v), time: t });
    } else {
      nullCount++;
    }
  }

  const validCount = timestamps.length;
  const nullPercentage = count > 0 ? (nullCount / count) * 100 : 0;

  if (validCount === 0) {
    return {
      count,
      validCount: 0,
      nullCount,
      nullPercentage: Math.round(nullPercentage * 10) / 10,
      minDate: null,
      maxDate: null,
      spanDays: null,
      approximateGranularity: "irregular",
      isChronological: false,
    };
  }

  const sortedTimes = [...timestamps].sort((a, b) => a.time - b.time);
  const minTime = sortedTimes[0].time;
  const maxTime = sortedTimes[sortedTimes.length - 1].time;
  const spanMs = maxTime - minTime;
  const spanDays = Math.round((spanMs / (1000 * 60 * 60 * 24)) * 10) / 10;

  // Check if originally in chronological order
  let isChronological = true;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i].time < timestamps[i - 1].time) {
      isChronological = false;
      break;
    }
  }

  // Estimate granularity from median difference between consecutive sorted points
  let granularity: DateStatistics["approximateGranularity"] = "irregular";
  if (sortedTimes.length > 2) {
    const diffs: number[] = [];
    for (let i = 1; i < sortedTimes.length; i++) {
      const diff = sortedTimes[i].time - sortedTimes[i - 1].time;
      if (diff > 0) diffs.push(diff);
    }
    if (diffs.length > 0) {
      diffs.sort((a, b) => a - b);
      const medianDiffDays = diffs[Math.floor(diffs.length / 2)] / (1000 * 60 * 60 * 24);
      if (medianDiffDays <= 1.5) granularity = "daily";
      else if (medianDiffDays <= 8) granularity = "weekly";
      else if (medianDiffDays <= 35) granularity = "monthly";
      else if (medianDiffDays <= 100) granularity = "quarterly";
      else if (medianDiffDays <= 380) granularity = "yearly";
    }
  }

  return {
    count,
    validCount,
    nullCount,
    nullPercentage: Math.round(nullPercentage * 10) / 10,
    minDate: sortedTimes[0].original,
    maxDate: sortedTimes[sortedTimes.length - 1].original,
    spanDays,
    approximateGranularity: granularity,
    isChronological,
  };
}

/**
 * Profiles an entire dataset deterministically.
 */
export function profileDataset(
  tableId: string,
  fileName: string,
  rows: Record<string, any>[]
): { profile: DatasetProfile; dataQuality: DataQualityReport } {
  const rowCount = rows.length;
  if (rowCount === 0) {
    const emptyQuality: DataQualityReport = {
      totalRows: 0,
      duplicateRowsCount: 0,
      overallCompletenessPct: 0,
      columnsWithNulls: [],
      outliersSummary: [],
      qualityNotes: ["The dataset is completely empty."],
    };
    return {
      profile: {
        tableId,
        fileName,
        rowCount: 0,
        columnCount: 0,
        columns: [],
        correlations: [],
        groupRelationships: [],
        temporalRelationships: [],
        dataQuality: emptyQuality,
      },
      dataQuality: emptyQuality,
    };
  }

  // Extract all unique column keys
  const columnKeysSet = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => columnKeysSet.add(k));
  });
  const columnNames = Array.from(columnKeysSet);

  // Column-level profiling
  const columns: ColumnProfile[] = [];
  const columnsWithNulls: Array<{ column: string; nullCount: number; nullPct: number }> = [];
  const outliersSummary: Array<{ column: string; outlierCount: number }> = [];

  let totalCells = rowCount * columnNames.length;
  let nonNullCells = 0;

  for (const colName of columnNames) {
    const values = rows.map((r) => r[colName]);
    const inferredType = inferColumnType(colName, values, rowCount);

    const nonNullValues = values.filter((v) => !isNilOrEmpty(v));
    const nullCount = rowCount - nonNullValues.length;
    const nullPercentage = Math.round((nullCount / rowCount) * 1000) / 10;
    const uniqueValues = new Set(nonNullValues.map((v) => String(v).trim()));
    const uniqueCount = uniqueValues.size;
    const uniquePercentage =
      nonNullValues.length > 0 ? Math.round((uniqueCount / nonNullValues.length) * 1000) / 10 : 0;

    nonNullCells += nonNullValues.length;

    if (nullCount > 0) {
      columnsWithNulls.push({ column: colName, nullCount, nullPct: nullPercentage });
    }

    const sampleValues = nonNullValues.slice(0, 5).map((v) => {
      if (typeof v === "number" || typeof v === "boolean") return v;
      return String(v);
    });

    const colProfile: ColumnProfile = {
      name: colName,
      inferredType,
      rowCount,
      nullCount,
      nullPercentage,
      uniqueCount,
      uniquePercentage,
      sampleValues,
    };

    if (inferredType === "numeric") {
      const stats = computeNumericStatistics(values);
      colProfile.numericStats = stats;
      if (stats.possibleOutliersCount > 0) {
        outliersSummary.push({
          column: colName,
          outlierCount: stats.possibleOutliersCount,
        });
      }
    } else if (inferredType === "category" || inferredType === "boolean" || inferredType === "id") {
      colProfile.categoricalStats = computeCategoricalStatistics(values);
    } else if (inferredType === "date") {
      colProfile.dateStats = computeDateStatistics(values);
    }

    columns.push(colProfile);
  }

  // Duplicate rows detection
  const rowSignatures = new Set<string>();
  let duplicateRowsCount = 0;
  for (const row of rows) {
    const sig = JSON.stringify(row);
    if (rowSignatures.has(sig)) {
      duplicateRowsCount++;
    } else {
      rowSignatures.add(sig);
    }
  }

  const overallCompletenessPct =
    totalCells > 0 ? Math.round((nonNullCells / totalCells) * 1000) / 10 : 100;

  const qualityNotes: string[] = [];
  if (duplicateRowsCount > 0) {
    qualityNotes.push(
      `Detected ${duplicateRowsCount} duplicate row${duplicateRowsCount > 1 ? "s" : ""} (${((duplicateRowsCount / rowCount) * 100).toFixed(1)}% of rows).`
    );
  }
  if (columnsWithNulls.length > 0) {
    qualityNotes.push(
      `${columnsWithNulls.length} column${columnsWithNulls.length > 1 ? "s have" : " has"} missing values.`
    );
  }
  if (outliersSummary.length > 0) {
    qualityNotes.push(
      `Outliers detected in ${outliersSummary.map((o) => `${o.column} (${o.outlierCount})`).join(", ")}.`
    );
  }
  if (overallCompletenessPct >= 99) {
    qualityNotes.push("Dataset completeness is very high (>99%).");
  }

  const dataQuality: DataQualityReport = {
    totalRows: rowCount,
    duplicateRowsCount,
    overallCompletenessPct,
    columnsWithNulls,
    outliersSummary,
    qualityNotes,
  };

  return {
    profile: {
      tableId,
      fileName,
      rowCount,
      columnCount: columnNames.length,
      columns,
      correlations: [], // will be populated by relationshipAnalyzer
      groupRelationships: [],
      temporalRelationships: [],
      dataQuality,
    },
    dataQuality,
  };
}
