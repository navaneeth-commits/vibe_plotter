import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeNumericStatistics,
  computeCategoricalStatistics,
  computeDateStatistics,
  inferColumnType,
  profileDataset,
  generateRowSignature,
} from "../src/utils/profiler/statisticalProfiler";
import {
  computePearsonCorrelation,
  computeSpearmanCorrelation,
  classifyCorrelation,
  analyzeCorrelations,
  analyzeCrossFileCompatibility,
} from "../src/utils/profiler/relationshipAnalyzer";
import { generateDeterministicRecommendations } from "../src/utils/profiler/recommendationEngine";
import { validateAndRepairRecommendation, validateRecommendations } from "../src/utils/profiler/recommendationValidator";
import { prepareChartData } from "../src/utils/chartDataProcessor";
import { ParsedTable, PlotConfig } from "../src/types";

describe("Deterministic Statistical Profiler", () => {
  test("computes correct numeric statistics: min, max, mean, median, stdDev, quartiles", () => {
    const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = computeNumericStatistics(data);

    assert.equal(stats.validCount, 10);
    assert.equal(stats.nullCount, 0);
    assert.equal(stats.min, 10);
    assert.equal(stats.max, 100);
    assert.equal(stats.mean, 55);
    assert.equal(stats.median, 55);
    assert.ok(stats.standardDeviation > 30 && stats.standardDeviation < 31);
    assert.equal(stats.zerosCount, 0);
    assert.equal(stats.negativesCount, 0);
  });

  test("detects IQR outliers accurately", () => {
    // 10 normal values + 1 extreme outlier
    const data = [10, 12, 11, 13, 10, 12, 11, 14, 12, 10, 500];
    const stats = computeNumericStatistics(data);

    assert.ok(stats.possibleOutliersCount >= 1);
    assert.ok(stats.sampleOutliers.includes(500));
  });

  test("handles empty and null values defensively", () => {
    const data = [null, undefined, "", NaN, "  "];
    const stats = computeNumericStatistics(data);

    assert.equal(stats.validCount, 0);
    assert.equal(stats.nullCount, 5);
    assert.equal(stats.nullPercentage, 100);
  });

  test("computes categorical distributions and mode", () => {
    const data = ["North America", "Europe", "North America", "Asia", "North America", "Europe"];
    const cat = computeCategoricalStatistics(data);

    assert.equal(cat.validCount, 6);
    assert.equal(cat.uniqueCount, 3);
    assert.equal(cat.mode, "North America");
    assert.equal(cat.topValues[0].value, "North America");
    assert.equal(cat.topValues[0].count, 3);
    assert.equal(cat.topValues[0].percentage, 50);
  });

  test("computes date statistics and chronological span", () => {
    const dates = ["2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01"];
    const dateStats = computeDateStatistics(dates);

    assert.equal(dateStats.validCount, 4);
    assert.equal(dateStats.minDate, "2023-01-01");
    assert.equal(dateStats.maxDate, "2023-04-01");
    assert.equal(dateStats.isChronological, true);
    assert.ok(dateStats.spanDays && dateStats.spanDays >= 89 && dateStats.spanDays <= 91);
  });

  test("infers column types correctly", () => {
    assert.equal(inferColumnType("Revenue", [100, 200, 300], 3), "numeric");
    assert.equal(inferColumnType("OrderDate", ["2024-01-01", "2024-02-01"], 2), "date");
    assert.equal(inferColumnType("Quarter", ["2023-Q1", "2023-Q2"], 2), "date");
    assert.equal(inferColumnType("Status", ["Active", "Pending", "Active"], 3), "category");
    assert.equal(inferColumnType("customer_id", ["C-001", "C-002", "C-003"], 3), "id");
    assert.equal(inferColumnType("is_valid", [true, false, true], 3), "boolean");
  });

  test("detects duplicate rows stably regardless of object key order", () => {
    const rows = [
      { a: 1, b: "hello", c: true },
      { c: true, a: 1, b: "hello" }, // identical values, reversed key order
      { b: "hello", c: true, a: 2 }, // different value
    ];
    const { dataQuality } = profileDataset("t_dup", "dup_test.csv", rows);
    assert.equal(dataQuality.totalRows, 3);
    assert.equal(dataQuality.duplicateRowsCount, 1);
  });

  test("profileDataset flags duplicate rows when objects have identical values but scrambled key insertion order", () => {
    const row1: Record<string, unknown> = {};
    row1.name = "Alice";
    row1.age = 30;
    row1.city = "San Francisco";
    row1.active = true;

    const row2: Record<string, unknown> = {};
    row2.active = true;
    row2.city = "San Francisco";
    row2.name = "Alice";
    row2.age = 30;

    const row3: Record<string, unknown> = {};
    row3.age = 30;
    row3.name = "Alice";
    row3.active = true;
    row3.city = "San Francisco";

    const row4: Record<string, unknown> = {};
    row4.name = "Bob";
    row4.age = 25;
    row4.city = "Oakland";
    row4.active = false;

    // Verify raw JSON.stringify would fail on unordered keys
    assert.notEqual(JSON.stringify(row1), JSON.stringify(row2));

    const { dataQuality } = profileDataset("t_scrambled", "scrambled.csv", [row1, row2, row3, row4]);
    assert.equal(dataQuality.totalRows, 4);
    assert.equal(dataQuality.duplicateRowsCount, 2, "row2 and row3 are duplicates of row1");
  });

  test("generateRowSignature produces identical signatures for rows with differing key orders", () => {
    const rowA = { z: 99, a: "test", m: null };
    const rowB = { a: "test", m: null, z: 99 };
    const rowC = { a: "test", m: 0, z: 99 };

    const sigA = generateRowSignature(rowA);
    const sigB = generateRowSignature(rowB);
    const sigC = generateRowSignature(rowC);

    assert.equal(sigA, sigB);
    assert.notEqual(sigA, sigC);
    assert.equal(sigA, `a:"test"|m:null|z:99`);
  });
});

describe("Relationship & Correlation Analyzer", () => {
  test("computes exact Pearson correlation coefficient (perfect positive)", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const res = computePearsonCorrelation(x, y);

    assert.ok(res !== null);
    assert.equal(res.r, 1);
    assert.equal(res.n, 5);
  });

  test("computes negative Pearson correlation accurately", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    const res = computePearsonCorrelation(x, y);

    assert.ok(res !== null);
    assert.equal(res.r, -1);
  });

  test("computes Spearman rank correlation", () => {
    const x = [10, 20, 30, 40, 50];
    const y = [15, 25, 35, 45, 55];
    const res = computeSpearmanCorrelation(x, y);

    assert.ok(res !== null);
    assert.equal(res.r, 1);
  });

  test("classifies correlation with accurate non-causal language", () => {
    const c1 = classifyCorrelation(0.85);
    assert.equal(c1.strength, "strong_positive");
    assert.ok(c1.description.includes("Strong positive linear association"));
    assert.ok(!c1.description.includes("causes"));

    const c2 = classifyCorrelation(-0.75);
    assert.equal(c2.strength, "strong_negative");
  });

  test("analyzes dataset pairwise correlations", () => {
    const rows = [
      { a: 1, b: 2, c: 5 },
      { a: 2, b: 4, c: 4 },
      { a: 3, b: 6, c: 3 },
      { a: 4, b: 8, c: 2 },
    ];
    const correlations = analyzeCorrelations(rows, ["a", "b", "c"]);
    assert.ok(correlations.length > 0);
    const ab = correlations.find((c) => (c.col1 === "a" && c.col2 === "b") || (c.col1 === "b" && c.col2 === "a"));
    assert.ok(ab);
    assert.equal(ab.pearsonR, 1);
  });
});

describe("Multi-File Compatibility Analyzer", () => {
  test("identifies compatible tables sharing a common key dimension", () => {
    const rows1 = [
      { Quarter: "2023-Q1", Sales: 100 },
      { Quarter: "2023-Q2", Sales: 200 },
    ];
    const rows2 = [
      { Quarter: "2023-Q1", Expenses: 50 },
      { Quarter: "2023-Q2", Expenses: 90 },
    ];

    const { profile: p1 } = profileDataset("t1", "sales.csv", rows1);
    const { profile: p2 } = profileDataset("t2", "costs.csv", rows2);

    const compat = analyzeCrossFileCompatibility(p1, p2, rows1, rows2, 0, 1);
    assert.equal(compat.compatible, true);
    assert.ok(compat.commonKeyCandidates.includes("Quarter"));
  });

  test("rejects incompatible tables with no shared keys or schemas", () => {
    const rows1 = [
      { Country: "USA", Population: 330 },
      { Country: "Germany", Population: 84 },
    ];
    const rows2 = [
      { PixelX: 120, PixelY: 480, Brightness: 0.9 },
      { PixelX: 130, PixelY: 490, Brightness: 0.8 },
    ];

    const { profile: p1 } = profileDataset("t1", "demographics.csv", rows1);
    const { profile: p2 } = profileDataset("t2", "image_pixels.csv", rows2);

    const compat = analyzeCrossFileCompatibility(p1, p2, rows1, rows2, 0, 1);
    assert.equal(compat.compatible, false);
    assert.ok(compat.reason.includes("No reliable cross-file relationship"));
  });

  test("preserves '0' as a valid join-key value and contributes to overlap detection", () => {
    const rows1 = [
      { Group_Id: "0", MetricA: 10 },
      { Group_Id: "1", MetricA: 20 },
      { Group_Id: "2", MetricA: 30 },
    ];
    const rows2 = [
      { Group_Id: "0", MetricB: 100 },
      { Group_Id: "1", MetricB: 200 },
      { Group_Id: "2", MetricB: 300 },
    ];

    const { profile: p1 } = profileDataset("t1", "clusters_a.csv", rows1);
    const { profile: p2 } = profileDataset("t2", "clusters_b.csv", rows2);

    const compat = analyzeCrossFileCompatibility(p1, p2, rows1, rows2, 0, 1);
    assert.equal(compat.compatible, true);
    assert.ok(compat.commonKeyCandidates.includes("Group_Id"));

    const mapping = compat.joinKeyMappings.find(
      (m) => m.primaryKey === "Group_Id" && m.secondaryKey === "Group_Id"
    );
    assert.ok(mapping);
    // Crucial: "0" must not be discarded as a placeholder; all 3 values (0, 1, 2) must match
    assert.equal(mapping.sharedValuesCount, 3);
    assert.equal(mapping.overlapRatio, 1.0);
  });
});

describe("Deterministic Fallback & Recommendation Validation", () => {
  test("generates deterministic recommendations with grounded metrics", () => {
    const rows = [
      { Date: "2024-01-01", Category: "Tech", Revenue: 1000, Profit: 300 },
      { Date: "2024-01-02", Category: "Retail", Revenue: 1500, Profit: 450 },
      { Date: "2024-01-03", Category: "Tech", Revenue: 1200, Profit: 350 },
      { Date: "2024-01-04", Category: "Retail", Revenue: 1800, Profit: 520 },
    ];
    const { profile } = profileDataset("t1", "sales.csv", rows);
    profile.correlations = analyzeCorrelations(rows, ["Revenue", "Profit"]);

    const recs = generateDeterministicRecommendations([profile], []);
    assert.ok(recs.length >= 2);

    // Verify time series exists
    const lineRec = recs.find((r) => r.plotType === "line");
    assert.ok(lineRec);
    assert.equal(lineRec.xAxis, "Date");

    // Verify scatter plot exists and references correlation
    const scatterRec = recs.find((r) => r.plotType === "scatter");
    assert.ok(scatterRec);
    assert.ok(scatterRec.reason.includes("Pearson correlation"));
  });

  test("strictly discards hallucinated recommendations and falls back gracefully", () => {
    const rows = [
      { Region: "North", Sales: 100 },
      { Region: "South", Sales: 200 },
    ];
    const { profile } = profileDataset("t1", "sales.csv", rows);

    // Hallucinated recommendation with non-existent columns
    const fakeRec = {
      title: "Hallucinated Chart",
      plotType: "scatter",
      fileIndex: 0,
      xAxis: "NonExistentColumn",
      yAxis: "Sales",
      description: "This proves Sales causes profits",
      reason: "Random reason",
    };

    const validated = validateAndRepairRecommendation(fakeRec, [profile], []);
    // Hallucinated column recommendations MUST be discarded, not hallucinated into another column
    assert.equal(validated, null);

    // When validated via validateRecommendations, fallback recommendations are used
    const recs = validateRecommendations([fakeRec], [profile], []);
    assert.ok(recs.length >= 1);
    assert.ok(recs.every((r) => r.xAxis === "Region" && r.yAxis === "Sales"));
  });

  test("rejects pie charts with negative metrics, all-zero totals, or invalid cardinality", () => {
    const rowsWithNegatives = [
      { Category: "A", Profit: -50 },
      { Category: "B", Profit: 100 },
      { Category: "C", Profit: 200 },
    ];
    const { profile: p1 } = profileDataset("t1", "p1.csv", rowsWithNegatives);
    const rec1 = {
      title: "Profit Share",
      plotType: "pie",
      fileIndex: 0,
      xAxis: "Category",
      yAxis: "Profit",
    };
    // Should be rejected due to negative profit
    assert.equal(validateAndRepairRecommendation(rec1, [p1], []), null);

    const rowsWithZeroTotal = [
      { Category: "A", Amount: 0 },
      { Category: "B", Amount: 0 },
      { Category: "C", Amount: 0 },
    ];
    const { profile: p2 } = profileDataset("t2", "p2.csv", rowsWithZeroTotal);
    const rec2 = {
      title: "Zero Share",
      plotType: "pie",
      fileIndex: 0,
      xAxis: "Category",
      yAxis: "Amount",
    };
    // Should be rejected due to zero total
    assert.equal(validateAndRepairRecommendation(rec2, [p2], []), null);
  });
});

describe("Statistical Edge Cases & Data Pipeline Integrity", () => {
  test("returns null for Pearson correlation on zero variance / constant arrays", () => {
    const x = [5, 5, 5, 5, 5];
    const y = [1, 2, 3, 4, 5];
    const res = computePearsonCorrelation(x, y);
    assert.equal(res, null);
  });

  test("suppresses outliers when sample size is too small (N < 4)", () => {
    const data = [1, 2, 1000];
    const stats = computeNumericStatistics(data);
    assert.equal(stats.possibleOutliersCount, 0);
    assert.equal(stats.sampleOutliers.length, 0);
  });

  test("classifies financial metric columns as numeric, never mistakenly as id", () => {
    assert.equal(inferColumnType("amount_paid", [10.5, 20.0, 30.2], 3), "numeric");
    assert.equal(inferColumnType("unit_price", [99, 149, 199], 3), "numeric");
    assert.equal(inferColumnType("total_revenue", [1000, 2000, 3000], 3), "numeric");
    assert.equal(inferColumnType("bid", [1.5, 2.5, 3.5], 3), "numeric");
    assert.equal(inferColumnType("zip_code", ["90210", "10001", "02138"], 3), "id");
  });

  test("performs key-based cross-file join accurately in prepareChartData", () => {
    const table1: ParsedTable = {
      id: "tbl_sales",
      fileName: "sales.csv",
      fileSize: 1024,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 3,
      columns: [
        { name: "Quarter", type: "date", sampleValues: ["2023-Q1"], uniqueCount: 3, nonEmptyCount: 3 },
        { name: "Revenue", type: "numeric", sampleValues: [100], uniqueCount: 3, nonEmptyCount: 3 },
      ],
      rows: [
        { Quarter: "2023-Q1", Revenue: 100 },
        { Quarter: "2023-Q2", Revenue: 150 },
        { Quarter: "2023-Q3", Revenue: 200 },
      ],
    };

    const table2: ParsedTable = {
      id: "tbl_costs",
      fileName: "costs.csv",
      fileSize: 1024,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 3,
      columns: [
        { name: "Quarter", type: "date", sampleValues: ["2023-Q1"], uniqueCount: 3, nonEmptyCount: 3 },
        { name: "Expenses", type: "numeric", sampleValues: [60], uniqueCount: 3, nonEmptyCount: 3 },
      ],
      rows: [
        // Out of order to verify true key matching
        { Quarter: "2023-Q3", Expenses: 120 },
        { Quarter: "2023-Q1", Expenses: 60 },
        { Quarter: "2023-Q2", Expenses: 90 },
      ],
    };

    const config: PlotConfig = {
      id: "p1",
      title: "Cross Revenue vs Expenses",
      plotType: "composed",
      primaryTableId: "tbl_sales",
      xAxisCol: "Quarter",
      yAxisCols: ["Revenue"],
      isCrossFile: true,
      secondaryTableId: "tbl_costs",
      secondaryYAxisCol: "Expenses",
      matchKeyPrimary: "Quarter",
      matchKeySecondary: "Quarter",
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const { chartData } = prepareChartData(config, {
      tbl_sales: table1,
      tbl_costs: table2,
    });

    assert.equal(chartData.length, 3);
    const q1 = chartData.find((r) => r.Quarter === "2023-Q1");
    assert.ok(q1);
    assert.equal(q1["[sales.csv] Revenue"], 100);
    assert.equal(q1["[costs.csv] Expenses"], 60);

    const q3 = chartData.find((r) => r.Quarter === "2023-Q3");
    assert.ok(q3);
    assert.equal(q3["[sales.csv] Revenue"], 200);
    assert.equal(q3["[costs.csv] Expenses"], 120);
  });

  test("does not guess secondary join key or silently join against secondary table first column when matchKeySecondary is missing", () => {
    const tablePrimary: ParsedTable = {
      id: "tbl_p",
      fileName: "primary.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 2,
      columns: [
        { name: "Year", type: "category", sampleValues: ["2023"], uniqueCount: 2, nonEmptyCount: 2 },
        { name: "Revenue", type: "numeric", sampleValues: [100], uniqueCount: 2, nonEmptyCount: 2 },
      ],
      rows: [
        { Year: "2023", Revenue: 100 },
        { Year: "2024", Revenue: 150 },
      ],
    };

    // Secondary table where the FIRST column is UnrelatedCode (not Year)
    const tableSecondary: ParsedTable = {
      id: "tbl_s",
      fileName: "secondary.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 2,
      columns: [
        { name: "UnrelatedCode", type: "category", sampleValues: ["2023"], uniqueCount: 2, nonEmptyCount: 2 },
        { name: "Year", type: "category", sampleValues: ["2023"], uniqueCount: 2, nonEmptyCount: 2 },
        { name: "Expenses", type: "numeric", sampleValues: [50], uniqueCount: 2, nonEmptyCount: 2 },
      ],
      rows: [
        { UnrelatedCode: "2023", Year: "2023", Expenses: 50 },
        { UnrelatedCode: "2024", Year: "2024", Expenses: 80 },
      ],
    };

    const configNoSecKey: PlotConfig = {
      id: "p_no_sec",
      title: "Cross without verified secondary key",
      plotType: "composed",
      primaryTableId: "tbl_p",
      xAxisCol: "Year",
      yAxisCols: ["Revenue"],
      isCrossFile: true,
      secondaryTableId: "tbl_s",
      secondaryYAxisCol: "Expenses",
      matchKeyPrimary: "Year",
      // matchKeySecondary is intentionally omitted
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const result = prepareChartData(configNoSecKey, {
      tbl_p: tablePrimary,
      tbl_s: tableSecondary,
    });

    // Must return safe empty / no cross-file series data, NEVER silently joining against tableSecondary.columns[0]
    assert.equal(result.chartData.length, 0);
    assert.ok(!result.seriesKeys.includes("[secondary.csv] Expenses"));
  });

  test("preserves missing numeric values as null and does not coerce to zero", () => {
    const table: ParsedTable = {
      id: "tbl_nulls",
      fileName: "nulls.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 4,
      columns: [
        { name: "Item", type: "category", sampleValues: ["A"], uniqueCount: 4, nonEmptyCount: 4 },
        { name: "Score", type: "numeric", sampleValues: [10], uniqueCount: 3, nonEmptyCount: 3 },
      ],
      rows: [
        { Item: "A", Score: 10 },
        { Item: "B", Score: null },
        { Item: "C", Score: 0 }, // Legitimate zero
        { Item: "D", Score: "N/A" }, // Missing token
      ],
    };

    const config: PlotConfig = {
      id: "p_nulls",
      title: "Score by Item",
      plotType: "bar",
      primaryTableId: "tbl_nulls",
      xAxisCol: "Item",
      yAxisCols: ["Score"],
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const { chartData } = prepareChartData(config, { tbl_nulls: table });

    const itemA = chartData.find((r) => r.Item === "A");
    const itemB = chartData.find((r) => r.Item === "B");
    const itemC = chartData.find((r) => r.Item === "C");
    const itemD = chartData.find((r) => r.Item === "D");

    assert.equal(itemA?.Score, 10);
    // Crucial: B and D must NOT be 0!
    assert.equal(itemB?.Score, null);
    assert.equal(itemC?.Score, 0); // Legitimate zero preserved
    assert.equal(itemD?.Score, null);
  });

  test("correctly computes aggregations ignoring nulls rather than treating them as zero", () => {
    const table: ParsedTable = {
      id: "tbl_agg",
      fileName: "agg.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 4,
      columns: [
        { name: "Dept", type: "category", sampleValues: ["Engineering"], uniqueCount: 1, nonEmptyCount: 4 },
        { name: "Bonus", type: "numeric", sampleValues: [100], uniqueCount: 3, nonEmptyCount: 3 },
      ],
      rows: [
        { Dept: "Engineering", Bonus: 100 },
        { Dept: "Engineering", Bonus: null }, // Null
        { Dept: "Engineering", Bonus: 200 },
        { Dept: "Engineering", Bonus: "invalid" }, // Null
      ],
    };

    // Test mean aggregation: (100 + 200) / 2 = 150 (NOT 300 / 4 = 75)
    const configMean: PlotConfig = {
      id: "p_mean",
      title: "Average Bonus",
      plotType: "bar",
      primaryTableId: "tbl_agg",
      xAxisCol: "Dept",
      yAxisCols: ["Bonus"],
      aggregation: "mean",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const resMean = prepareChartData(configMean, { tbl_agg: table });
    assert.equal(resMean.chartData.length, 1);
    assert.equal(resMean.chartData[0].Bonus, 150);

    // Test count aggregation: should count valid numbers only = 2
    const configCount: PlotConfig = {
      ...configMean,
      id: "p_count",
      aggregation: "count",
    };
    const resCount = prepareChartData(configCount, { tbl_agg: table });
    assert.equal(resCount.chartData[0].Bonus, 2);

    // Test min & max
    const configMin: PlotConfig = { ...configMean, id: "p_min", aggregation: "min" };
    assert.equal(prepareChartData(configMin, { tbl_agg: table }).chartData[0].Bonus, 100);

    const configMax: PlotConfig = { ...configMean, id: "p_max", aggregation: "max" };
    assert.equal(prepareChartData(configMax, { tbl_agg: table }).chartData[0].Bonus, 200);
  });

  test("handles duplicate secondary join keys deterministically without row explosion", () => {
    const tablePrimary: ParsedTable = {
      id: "t_prim",
      fileName: "primary.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 2,
      columns: [
        { name: "Region", type: "category", sampleValues: ["North"], uniqueCount: 2, nonEmptyCount: 2 },
        { name: "Sales", type: "numeric", sampleValues: [500], uniqueCount: 2, nonEmptyCount: 2 },
      ],
      rows: [
        { Region: "North", Sales: 500 },
        { Region: "South", Sales: 300 },
      ],
    };

    const tableSecondary: ParsedTable = {
      id: "t_sec",
      fileName: "secondary.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 4,
      columns: [
        { name: "Region", type: "category", sampleValues: ["North"], uniqueCount: 2, nonEmptyCount: 4 },
        { name: "Tax", type: "numeric", sampleValues: [50], uniqueCount: 4, nonEmptyCount: 4 },
      ],
      rows: [
        // Duplicate keys for North: 50 and 70 (mean = 60)
        { Region: "North", Tax: 50 },
        { Region: "North", Tax: 70 },
        // Single key for South: 30
        { Region: "South", Tax: 30 },
      ],
    };

    const config: PlotConfig = {
      id: "p_dup",
      title: "Sales and Tax",
      plotType: "composed",
      primaryTableId: "t_prim",
      xAxisCol: "Region",
      yAxisCols: ["Sales"],
      isCrossFile: true,
      secondaryTableId: "t_sec",
      secondaryYAxisCol: "Tax",
      matchKeyPrimary: "Region",
      matchKeySecondary: "Region",
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const { chartData } = prepareChartData(config, {
      t_prim: tablePrimary,
      t_sec: tableSecondary,
    });

    // Row count must remain 2 (exact primary rows), NOT 3 or 4 from duplicate multiplication
    assert.equal(chartData.length, 2);
    const north = chartData.find((r) => r.Region === "North");
    assert.ok(north);
    assert.equal(north["[primary.csv] Sales"], 500);
    // Deterministic mean of 50 and 70 is 60
    assert.equal(north["[secondary.csv] Tax"], 60);
  });

  test("generates valid histograms with identical values and handles nulls gracefully", () => {
    const tableIdentical: ParsedTable = {
      id: "t_hist",
      fileName: "hist.csv",
      fileSize: 100,
      fileType: "csv",
      uploadedAt: Date.now(),
      rowCount: 5,
      columns: [
        { name: "Rating", type: "numeric", sampleValues: [5], uniqueCount: 1, nonEmptyCount: 5 },
      ],
      rows: [
        { Rating: 5 },
        { Rating: 5 },
        { Rating: null },
        { Rating: 5 },
        { Rating: 5 },
      ],
    };

    const config: PlotConfig = {
      id: "p_hist",
      title: "Rating Distribution",
      plotType: "histogram",
      primaryTableId: "t_hist",
      xAxisCol: "Rating",
      yAxisCols: ["Rating"],
      aggregation: "none",
      theme: "sage-forest",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    const { chartData } = prepareChartData(config, { t_hist: tableIdentical });
    assert.ok(chartData.length >= 1);
    // Count should be 4 (ignoring null), no NaN bin ranges
    const totalCount = chartData.reduce((acc, bin) => acc + (Number(bin.count) || 0), 0);
    assert.equal(totalCount, 4);
    assert.ok(!chartData.some((bin) => String(bin.binRange).includes("NaN")));
  });
});
