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

/**
 * Robust number cleaner that handles strings with currency symbols ($ € £ ¥),
 * commas (1,000.50), percentages (15.2%), and trim whitespace.
 */
export function cleanNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (val === null || val === undefined) return 0;
  if (typeof val === "boolean") return val ? 1 : 0;
  const str = String(val).trim().replace(/[$€£¥%]/g, "").replace(/,/g, "");
  const num = Number(str);
  return isNaN(num) ? 0 : num;
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
      .filter((v) => !isNaN(v) && v !== null);

    if (values.length === 0) {
      return { chartData: [], seriesKeys: ["Frequency"], xAxisKey: "bin", palette };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, Math.max(5, Math.round(Math.sqrt(values.length))));
    const binWidth = (max - min) / (binCount || 1);

    const bins: { bin: string; Frequency: number; minVal: number; maxVal: number }[] = [];
    for (let i = 0; i < binCount; i++) {
      const bMin = min + i * binWidth;
      const bMax = min + (i + 1) * binWidth;
      const label = `${bMin.toFixed(1)} - ${bMax.toFixed(1)}`;
      bins.push({ bin: label, Frequency: 0, minVal: bMin, maxVal: bMax });
    }

    values.forEach((v) => {
      const binIdx = Math.min(binCount - 1, Math.floor((v - min) / (binWidth || 1)));
      if (bins[binIdx]) {
        bins[binIdx].Frequency++;
      }
    });

    return {
      chartData: bins,
      seriesKeys: ["Frequency"],
      xAxisKey: "bin",
      palette,
    };
  }

  // 2. PIE / DONUT SPECIAL HANDLING (Group slices by xCol and sum or count yCol)
  if (config.plotType === "pie") {
    const targetMetric = yCols[0];
    const sliceMap = new Map<string, number>();

    rows.forEach((r) => {
      const label = String(r[xCol] !== undefined && r[xCol] !== null ? r[xCol] : "Other");
      const val = targetMetric ? cleanNumber(r[targetMetric]) : 1;
      sliceMap.set(label, (sliceMap.get(label) || 0) + Math.abs(val));
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

  // 3. CROSS-FILE PLOTTING
  if (config.isCrossFile && config.secondaryTableId) {
    const secondaryTable = tablesMap[config.secondaryTableId];
    if (secondaryTable) {
      const pRows = primaryTable.rows;
      const sRows = secondaryTable.rows;
      const merged: Record<string, any>[] = [];

      const y1Cols = yCols;
      const y2Col = config.secondaryYAxisCol;

      const maxLen = Math.max(pRows.length, sRows.length);
      for (let i = 0; i < maxLen; i++) {
        const pR = pRows[i] || {};
        const sR = sRows[i] || {};

        const xVal = pR[xCol] !== undefined ? pR[xCol] : (sR[xCol] !== undefined ? sR[xCol] : `Row ${i + 1}`);
        const rowObj: Record<string, any> = { [xCol]: xVal };

        y1Cols.forEach((yCol) => {
          rowObj[`[${primaryTable.fileName}] ${yCol}`] = cleanNumber(pR[yCol]);
        });

        if (y2Col) {
          rowObj[`[${secondaryTable.fileName}] ${y2Col}`] = cleanNumber(sR[y2Col]);
        }

        merged.push(rowObj);
      }

      const seriesKeys = [
        ...y1Cols.map((yCol) => `[${primaryTable.fileName}] ${yCol}`),
        ...(y2Col ? [`[${secondaryTable.fileName}] ${y2Col}`] : []),
      ];

      return {
        chartData: merged,
        seriesKeys,
        xAxisKey: xCol,
        palette,
      };
    }
  }

  // 4. STANDARD SINGLE-TABLE PLOTTING (With Aggregation if requested)
  if (config.aggregation && config.aggregation !== "none") {
    const groupMap = new Map<string, { count: number; sums: Record<string, number>; mins: Record<string, number>; maxs: Record<string, number> }>();

    rows.forEach((r) => {
      const xKey = String(r[xCol] !== undefined && r[xCol] !== null ? r[xCol] : "N/A");
      if (!groupMap.has(xKey)) {
        groupMap.set(xKey, {
          count: 0,
          sums: {},
          mins: {},
          maxs: {},
        });
        yCols.forEach((y) => {
          groupMap.get(xKey)!.sums[y] = 0;
          groupMap.get(xKey)!.mins[y] = Infinity;
          groupMap.get(xKey)!.maxs[y] = -Infinity;
        });
      }

      const entry = groupMap.get(xKey)!;
      entry.count++;

      yCols.forEach((y) => {
        const val = cleanNumber(r[y]);
        entry.sums[y] += val;
        if (val < entry.mins[y]) entry.mins[y] = val;
        if (val > entry.maxs[y]) entry.maxs[y] = val;
      });
    });

    const aggregated: Record<string, any>[] = [];
    groupMap.forEach((entry, xKey) => {
      const rowObj: Record<string, any> = { [xCol]: xKey };

      if (config.aggregation === "count") {
        rowObj["Count"] = entry.count;
      } else {
        yCols.forEach((y) => {
          if (config.aggregation === "sum") {
            rowObj[y] = Math.round(entry.sums[y] * 100) / 100;
          } else if (config.aggregation === "mean") {
            rowObj[y] = Math.round((entry.sums[y] / (entry.count || 1)) * 100) / 100;
          } else if (config.aggregation === "min") {
            rowObj[y] = entry.mins[y] === Infinity ? 0 : entry.mins[y];
          } else if (config.aggregation === "max") {
            rowObj[y] = entry.maxs[y] === -Infinity ? 0 : entry.maxs[y];
          }
        });
      }
      aggregated.push(rowObj);
    });

    return {
      chartData: aggregated,
      seriesKeys: config.aggregation === "count" ? ["Count"] : yCols,
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
