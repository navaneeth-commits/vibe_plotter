import { ChartTheme, PlotConfig, ParsedTable } from "../types";

export interface PreparedChartData {
  chartData: Record<string, any>[];
  seriesKeys: string[];
  xAxisKey: string;
  palette: string[];
  yMin?: number;
  yMax?: number;
}

export const THEME_PALETTES: Record<ChartTheme, { colors: string[]; bg: string; border: string; text: string; label: string }> = {
  "amber-craft": {
    label: "Amber Craft",
    colors: ["#B45309", "#D97706", "#F59E0B", "#78350F", "#92400E", "#FBBF24"],
    bg: "#FFFDF9",
    border: "#FDE68A",
    text: "#78350F",
  },
  "ink-minimal": {
    label: "Ink & Graphite",
    colors: ["#18181B", "#52525B", "#71717A", "#27272A", "#3F3F46", "#A1A1AA"],
    bg: "#FAFAFA",
    border: "#E4E4E7",
    text: "#18181B",
  },
  "sage-forest": {
    label: "Sage Forest",
    colors: ["#047857", "#059669", "#10B981", "#064E3B", "#065F46", "#34D399"],
    bg: "#F7FBF9",
    border: "#A7F3D0",
    text: "#064E3B",
  },
  "studio-slate": {
    label: "Studio Slate",
    colors: ["#2563EB", "#3B82F6", "#60A5FA", "#1E40AF", "#1D4ED8", "#93C5FD"],
    bg: "#F8FAFC",
    border: "#BFDBFE",
    text: "#1E3A8A",
  },
  "indigo-night": {
    label: "Indigo Dusk",
    colors: ["#4F46E5", "#6366F1", "#818CF8", "#3730A3", "#4338CA", "#A5B4FC"],
    bg: "#F9F9FE",
    border: "#C7D2FE",
    text: "#312E81",
  },
  "sunset-coral": {
    label: "Sunset Terracotta",
    colors: ["#E11D48", "#F43F5E", "#FB7185", "#9F1239", "#BE123C", "#FDA4AF"],
    bg: "#FFF9FA",
    border: "#FECDD3",
    text: "#881337",
  },
};

const PLACEHOLDER_TOKENS = new Set([
  "",
  "na",
  "n/a",
  "null",
  "none",
  "nan",
  "undefined",
  "-",
  "--",
  ".",
  "?",
  "nil",
]);

/**
 * Robust number cleaner that handles strings with currency symbols ($ € £ ¥),
 * commas (1,000.50), percentages (15.2%), and trim whitespace.
 * Preserves missing/null/undefined/NaN as null rather than coercing to 0.
 */
export function cleanNumber(val: any): number | null {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? 1 : 0;
  const rawStr = String(val).trim();
  if (PLACEHOLDER_TOKENS.has(rawStr.toLowerCase())) return null;
  const str = rawStr.replace(/[$€£¥%]/g, "").replace(/,/g, "");
  if (str === "" || isNaN(Number(str))) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

/**
 * Transforms table(s) rows into Recharts-ready data adhering strictly to the user-selected plot type
 */
export function prepareChartData(
  config: PlotConfig,
  tablesMap: Record<string, ParsedTable>
): PreparedChartData {
  const primaryTable = tablesMap[config.primaryTableId];
  if (!primaryTable) {
    return { chartData: [], seriesKeys: [], xAxisKey: "", palette: THEME_PALETTES["amber-craft"].colors };
  }

  const palette = THEME_PALETTES[config.theme]?.colors || THEME_PALETTES["amber-craft"].colors;
  const rows = primaryTable.rows;
  const xCol = config.xAxisCol || primaryTable.columns[0]?.name || "index";
  const numCols = primaryTable.columns.filter((c) => c.type === "numeric");
  const yCols = config.yAxisCols.length > 0
    ? config.yAxisCols
    : (numCols.length > 0 ? [numCols[0].name] : [primaryTable.columns[1]?.name || xCol]);

  // 1. HISTOGRAM SPECIAL HANDLING
  if (config.plotType === "histogram") {
    const targetCol = yCols[0] || xCol;
    const values = rows
      .map((r) => cleanNumber(r[targetCol]))
      .filter((v): v is number => v !== null && Number.isFinite(v));

    if (values.length === 0) {
      return { chartData: [], seriesKeys: ["Frequency"], xAxisKey: "bin", palette };
    }

    let min = values[0];
    let max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }

    if (min === max) {
      return {
        chartData: [
          {
            bin: `${min}`,
            binRange: `${min}`,
            Frequency: values.length,
            count: values.length,
            minVal: min,
            maxVal: max,
          },
        ],
        seriesKeys: ["Frequency"],
        xAxisKey: "bin",
        palette,
      };
    }

    const binCount = Math.min(10, Math.max(5, Math.round(Math.sqrt(values.length))));
    const binWidth = (max - min) / (binCount || 1);

    const bins: {
      bin: string;
      binRange: string;
      Frequency: number;
      count: number;
      minVal: number;
      maxVal: number;
    }[] = [];

    for (let i = 0; i < binCount; i++) {
      const bMin = min + i * binWidth;
      const bMax = min + (i + 1) * binWidth;
      const label = `${bMin.toFixed(1)} - ${bMax.toFixed(1)}`;
      bins.push({
        bin: label,
        binRange: label,
        Frequency: 0,
        count: 0,
        minVal: bMin,
        maxVal: bMax,
      });
    }

    values.forEach((v) => {
      const binIdx = Math.min(binCount - 1, Math.floor((v - min) / (binWidth || 1)));
      if (bins[binIdx]) {
        bins[binIdx].Frequency++;
        bins[binIdx].count++;
      }
    });

    return {
      chartData: bins,
      seriesKeys: ["Frequency"],
      xAxisKey: "bin",
      palette,
    };
  }

  // 2. PIE / DONUT SPECIAL HANDLING (Group slices by xCol and sum yCol, ignoring nulls and negatives)
  if (config.plotType === "pie") {
    const targetMetric = yCols[0];
    const sliceMap = new Map<string, number>();

    rows.forEach((r) => {
      const label = String(r[xCol] !== undefined && r[xCol] !== null ? r[xCol] : "Other");
      let val = 1;
      if (targetMetric) {
        const cleaned = cleanNumber(r[targetMetric]);
        val = cleaned !== null ? Math.max(0, cleaned) : 0;
      }
      sliceMap.set(label, (sliceMap.get(label) || 0) + val);
    });

    // Convert map to array and sort descending
    let slices = Array.from(sliceMap.entries())
      .map(([name, value]) => ({ [xCol]: name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    // If more than 7 slices, bundle tail into "Other"
    if (slices.length > 7) {
      const head = slices.slice(0, 6);
      const tailSum = slices.slice(6).reduce((acc, s) => acc + s.value, 0);
      slices = [...head, { [xCol]: "Other", value: Math.round(tailSum * 100) / 100 }];
    }

    return {
      chartData: slices,
      seriesKeys: ["value"],
      xAxisKey: xCol,
      palette,
    };
  }

  // 3. CROSS-FILE PLOTTING (Key-based alignment with deterministic duplicate key handling)
  if (config.isCrossFile && config.secondaryTableId) {
    const secondaryTable = tablesMap[config.secondaryTableId];
    if (secondaryTable) {
      const pRows = primaryTable.rows;
      const sRows = secondaryTable.rows;

      // Identify join key in primary and secondary tables
      const primaryKey = config.matchKeyPrimary || config.xAxisCol || primaryTable.columns[0]?.name || "id";
      let secKey = config.matchKeySecondary;
      if (!secKey) {
        const secColMatch = secondaryTable.columns.find(
          (c) => c.name.toLowerCase().trim() === primaryKey.toLowerCase().trim()
        );
        secKey = secColMatch ? secColMatch.name : (secondaryTable.columns[0]?.name || primaryKey);
      }

      // Group secondary table by key to handle duplicates deterministically (mean aggregation)
      const y2Col = config.secondaryYAxisCol;
      const sValuesMap = new Map<string, number[]>();

      sRows.forEach((sr) => {
        const rawKey = sr[secKey!] !== undefined && sr[secKey!] !== null ? sr[secKey!] : "";
        const keyVal = String(rawKey).trim().toLowerCase();
        if (keyVal.length > 0 && y2Col && sr[y2Col] !== undefined) {
          const num = cleanNumber(sr[y2Col]);
          if (num !== null) {
            if (!sValuesMap.has(keyVal)) {
              sValuesMap.set(keyVal, []);
            }
            sValuesMap.get(keyVal)!.push(num);
          }
        }
      });

      const y1Cols = yCols;
      const merged: Record<string, any>[] = [];

      pRows.forEach((pR, idx) => {
        const rawX = pR[primaryKey] !== undefined && pR[primaryKey] !== null ? pR[primaryKey] : `Row ${idx + 1}`;
        const lookupKey = String(rawX).trim().toLowerCase();
        const rowObj: Record<string, any> = { [primaryKey]: rawX };

        y1Cols.forEach((yCol) => {
          rowObj[`[${primaryTable.fileName}] ${yCol}`] = cleanNumber(pR[yCol]);
        });

        if (y2Col) {
          const vals = sValuesMap.get(lookupKey);
          if (vals && vals.length > 0) {
            // Deterministic average for duplicate matching keys
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            rowObj[`[${secondaryTable.fileName}] ${y2Col}`] = Math.round(avg * 100) / 100;
          } else {
            rowObj[`[${secondaryTable.fileName}] ${y2Col}`] = null;
          }
        }

        merged.push(rowObj);
      });

      const seriesKeys = [
        ...y1Cols.map((yCol) => `[${primaryTable.fileName}] ${yCol}`),
        ...(y2Col ? [`[${secondaryTable.fileName}] ${y2Col}`] : []),
      ];

      return {
        chartData: merged,
        seriesKeys,
        xAxisKey: primaryKey,
        palette,
      };
    }
  }

  // 4. STANDARD SINGLE-TABLE PLOTTING (With Aggregation if requested)
  if (config.aggregation && config.aggregation !== "none") {
    interface AggBin {
      totalRows: number;
      sums: Record<string, number>;
      mins: Record<string, number>;
      maxs: Record<string, number>;
      validCounts: Record<string, number>;
    }

    const groupMap = new Map<string, AggBin>();

    rows.forEach((r) => {
      const xKey = String(r[xCol] !== undefined && r[xCol] !== null ? r[xCol] : "N/A");
      if (!groupMap.has(xKey)) {
        groupMap.set(xKey, {
          totalRows: 0,
          sums: {},
          mins: {},
          maxs: {},
          validCounts: {},
        });
        yCols.forEach((y) => {
          const bin = groupMap.get(xKey)!;
          bin.sums[y] = 0;
          bin.mins[y] = Infinity;
          bin.maxs[y] = -Infinity;
          bin.validCounts[y] = 0;
        });
      }

      const entry = groupMap.get(xKey)!;
      entry.totalRows++;

      yCols.forEach((y) => {
        const val = cleanNumber(r[y]);
        if (val !== null) {
          entry.sums[y] += val;
          entry.validCounts[y]++;
          if (val < entry.mins[y]) entry.mins[y] = val;
          if (val > entry.maxs[y]) entry.maxs[y] = val;
        }
      });
    });

    const aggregated: Record<string, any>[] = [];
    groupMap.forEach((entry, xKey) => {
      const rowObj: Record<string, any> = { [xCol]: xKey };

      if (config.aggregation === "count") {
        yCols.forEach((y) => {
          rowObj[y] = entry.validCounts[y];
        });
        rowObj["Count"] = entry.validCounts[yCols[0]] ?? entry.totalRows;
      } else {
        yCols.forEach((y) => {
          const vCount = entry.validCounts[y];
          if (vCount === 0) {
            rowObj[y] = null;
          } else if (config.aggregation === "sum") {
            rowObj[y] = Math.round(entry.sums[y] * 100) / 100;
          } else if (config.aggregation === "mean") {
            rowObj[y] = Math.round((entry.sums[y] / vCount) * 100) / 100;
          } else if (config.aggregation === "min") {
            rowObj[y] = entry.mins[y];
          } else if (config.aggregation === "max") {
            rowObj[y] = entry.maxs[y];
          }
        });
      }
      aggregated.push(rowObj);
    });

    return {
      chartData: aggregated,
      seriesKeys: yCols,
      xAxisKey: xCol,
      palette,
    };
  }

  // 5. DIRECT ROW MAPPING (No aggregation)
  const chartData = rows.map((r, idx) => {
    const item: Record<string, any> = {
      [xCol]: r[xCol] !== undefined ? r[xCol] : `Item ${idx + 1}`,
    };

    yCols.forEach((y) => {
      item[y] = cleanNumber(r[y]);
    });

    if (config.categoryCol && r[config.categoryCol]) {
      item["_category"] = r[config.categoryCol];
    }

    return item;
  });

  return {
    chartData,
    seriesKeys: yCols,
    xAxisKey: xCol,
    palette,
  };
}
