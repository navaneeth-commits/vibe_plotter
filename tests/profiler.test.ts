import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeNumericStatistics,
  computeCategoricalStatistics,
  computeDateStatistics,
  inferColumnType,
  profileDataset,
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

  test("strictly validates and repairs recommendations", () => {
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
    assert.ok(validated !== null);
    // xAxis should be repaired to Region
    assert.equal(validated.xAxis, "Region");
    // Scatter with categorical x should be repaired to bar
    assert.equal(validated.plotType, "bar");
    // "causes" should be sanitized
    assert.ok(!validated.description.includes("causes"));
  });
});
