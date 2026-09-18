import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractValidNumericPoints,
  calculateLinearTrendline,
  calculatePolynomialTrendline,
  calculateTrendline,
} from "../src/utils/trendline";
import { prepareChartData } from "../src/utils/chartDataProcessor";
import { ParsedTable, PlotConfig } from "../src/types";

describe("Trendline Calculation & Data Sanitization", () => {
  test("extractValidNumericPoints filters out nulls, NaNs, undefined, and non-numeric values while preserving 0 and negatives", () => {
    const rawData = [
      { x: 1, y: 10 },
      { x: 2, y: null },
      { x: null, y: 20 },
      { x: undefined, y: 30 },
      { x: 3, y: undefined },
      { x: "invalid", y: 40 },
      { x: 4, y: "N/A" },
      { x: NaN, y: 50 },
      { x: 5, y: NaN },
      { x: 0, y: 0 }, // 0 must be preserved
      { x: -5, y: -25 }, // Negatives preserved
      { x: "6", y: "36.5" }, // Numeric strings parsed
    ];

    const cleaned = extractValidNumericPoints(rawData, "x", "y");

    assert.equal(cleaned.length, 4);
    assert.deepEqual(cleaned[0], { x: 1, y: 10 });
    assert.deepEqual(cleaned[1], { x: 0, y: 0 });
    assert.deepEqual(cleaned[2], { x: -5, y: -25 });
    assert.deepEqual(cleaned[3], { x: 6, y: 36.5 });
  });

  test("calculateLinearTrendline accurately fits OLS linear regression (y = 3x + 4)", () => {
    // Exact line: y = 3x + 4
    const points = [
      { x: 1, y: 7 },
      { x: 2, y: 10 },
      { x: 3, y: 13 },
      { x: 4, y: 16 },
      { x: 5, y: 19 },
    ];

    const result = calculateLinearTrendline(points);
    assert.ok(result !== null);
    assert.equal(result.type, "linear");
    assert.ok(Math.abs(result.slope - 3) < 1e-6, `Expected slope 3, got ${result.slope}`);
    assert.ok(Math.abs(result.intercept - 4) < 1e-6, `Expected intercept 4, got ${result.intercept}`);
    assert.ok(Math.abs(result.r2 - 1) < 1e-6, `Expected R2 = 1, got ${result.r2}`);
    assert.equal(result.equation, "y = 3.00x + 4.00");

    // Test prediction function
    assert.ok(Math.abs(result.predict(10) - 34) < 1e-6);
  });

  test("calculateLinearTrendline handles negative slope and negative intercept", () => {
    // y = -2.5x - 1.5
    const points = [
      { x: 0, y: -1.5 },
      { x: 1, y: -4 },
      { x: 2, y: -6.5 },
      { x: 3, y: -9 },
    ];

    const result = calculateLinearTrendline(points);
    assert.ok(result !== null);
    assert.ok(Math.abs(result.slope - (-2.5)) < 1e-6);
    assert.ok(Math.abs(result.intercept - (-1.5)) < 1e-6);
    assert.equal(result.equation, "y = -2.50x - 1.50");
  });

  test("calculateLinearTrendline safely handles horizontal and degenerate cases", () => {
    // Horizontal line: y = 5
    const horizontal = [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ];
    const hResult = calculateLinearTrendline(horizontal);
    assert.ok(hResult !== null);
    assert.equal(hResult.slope, 0);
    assert.equal(hResult.intercept, 5);

    // Vertical points (zero variance in X): no OLS slope possible
    const vertical = [
      { x: 4, y: 1 },
      { x: 4, y: 5 },
      { x: 4, y: 9 },
    ];
    const vResult = calculateLinearTrendline(vertical);
    assert.equal(vResult, null);

    // Fewer than 2 points
    assert.equal(calculateLinearTrendline([{ x: 1, y: 2 }]), null);
    assert.equal(calculateLinearTrendline([]), null);
  });

  test("calculatePolynomialTrendline fits quadratic curve (degree 2) accurately (y = x^2 - 2x + 3)", () => {
    // y = 1*x^2 - 2*x + 3
    const xVals = [-2, -1, 0, 1, 2, 3, 4];
    const points = xVals.map((x) => ({ x, y: x * x - 2 * x + 3 }));

    const result = calculatePolynomialTrendline(points, 2);
    assert.ok(result !== null);
    assert.equal(result.type, "polynomial");
    assert.equal(result.coefficients.length, 3);

    // coeffs are [c, b, a] for y = c + bx + ax^2
    const [c, b, a] = result.coefficients;
    assert.ok(Math.abs(c - 3) < 1e-4, `Expected c=3, got ${c}`);
    assert.ok(Math.abs(b - (-2)) < 1e-4, `Expected b=-2, got ${b}`);
    assert.ok(Math.abs(a - 1) < 1e-4, `Expected a=1, got ${a}`);
    assert.ok(Math.abs(result.r2 - 1) < 1e-4, `Expected R2=1, got ${result.r2}`);
    assert.equal(result.equation, "y = 1.00x² - 2.00x + 3.00");

    // Test prediction at x = 5: 25 - 10 + 3 = 18
    assert.ok(Math.abs(result.predict(5) - 18) < 1e-4);
  });

  test("calculatePolynomialTrendline falls back to linear if points are fewer than degree + 1", () => {
    const twoPoints = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ];
    // Degree 2 needs at least 3 points; should gracefully fall back to linear
    const result = calculatePolynomialTrendline(twoPoints, 2);
    assert.ok(result !== null);
    assert.equal(result.type, "linear");
    assert.equal(result.slope, 2);
  });

  test("calculateTrendline unified helper returns null for none, linear for linear, polynomial for polynomial", () => {
    const pts = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 7 },
    ];

    assert.equal(calculateTrendline(pts, "none"), null);

    const lin = calculateTrendline(pts, "linear");
    assert.ok(lin !== null && lin.type === "linear");

    const poly = calculateTrendline(pts, "polynomial", 2);
    assert.ok(poly !== null && poly.type === "polynomial");
  });
});

describe("Chart Data Processor Trendline Integration", () => {
  const sampleTable: ParsedTable = {
    id: "table-1",
    fileName: "metrics.csv",
    fileType: "csv",
    uploadedAt: Date.now(),
    fileSize: 1024,
    rowCount: 8,
    columns: [
      { name: "Month", type: "numeric", sampleValues: [1, 2, 3, 4, 5, 6, 7, 8], uniqueCount: 8, nonEmptyCount: 8 },
      { name: "Revenue", type: "numeric", sampleValues: [100, 200, 300, 400], uniqueCount: 6, nonEmptyCount: 6 },
      { name: "Profit", type: "numeric", sampleValues: [20, 40, 60, 80], uniqueCount: 7, nonEmptyCount: 7 },
    ],
    rows: [
      { Month: 1, Revenue: 100, Profit: 20 },
      { Month: 2, Revenue: 205, Profit: null }, // Null in Profit
      { Month: 3, Revenue: null, Profit: 62 },  // Null in Revenue
      { Month: 4, Revenue: 410, Profit: 81 },
      { Month: 5, Revenue: 495, Profit: 105 },
      { Month: 6, Revenue: 610, Profit: 118 },
      { Month: 7, Revenue: undefined, Profit: 140 }, // Undefined
      { Month: 8, Revenue: 805, Profit: 162 },
    ],
  };

  const tablesMap = { [sampleTable.id]: sampleTable };

  test("calculates linear trendline on scatter chart ignoring null and undefined values", () => {
    const config: PlotConfig = {
      id: "plot-scatter-1",
      title: "Scatter with Trendline",
      plotType: "scatter",
      primaryTableId: sampleTable.id,
      xAxisCol: "Month",
      yAxisCols: ["Revenue"],
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "linear",
      trendline: "linear",
      createdAt: Date.now(),
    };

    const prepared = prepareChartData(config, tablesMap);

    assert.ok(prepared.trendData !== undefined, "trendData should be generated");
    assert.ok(prepared.trendData!.length >= 2, "trendData should contain points");
    assert.ok(prepared.trendEquation !== undefined, "trendEquation should be present");
    assert.ok(prepared.trendR2 !== undefined, "trendR2 should be present");
    assert.ok(prepared.trendR2! > 0.95, `Expected high R2 for near-linear data, got ${prepared.trendR2}`);

    // Verify trend points span the valid X domain [1, 8]
    assert.equal(prepared.trendData![0]["Month"], 1);
    assert.equal(prepared.trendData![prepared.trendData!.length - 1]["Month"], 8);
  });

  test("calculates polynomial trendline on scatter chart ignoring null values", () => {
    const config: PlotConfig = {
      id: "plot-scatter-poly",
      title: "Scatter with Poly Trendline",
      plotType: "scatter",
      primaryTableId: sampleTable.id,
      xAxisCol: "Month",
      yAxisCols: ["Revenue"],
      aggregation: "none",
      theme: "studio-slate",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      trendline: "polynomial",
      polynomialOrder: 2,
      createdAt: Date.now(),
    };

    const prepared = prepareChartData(config, tablesMap);

    assert.ok(prepared.trendData !== undefined);
    assert.equal(prepared.trendData!.length, 50, "Polynomial trendline generates 50 smooth curve points");
    assert.ok(prepared.trendEquation!.includes("x²"), `Equation should include x²: ${prepared.trendEquation}`);
    assert.ok(prepared.trendR2! > 0.95);
  });

  test("calculates trendlines on line chart and adds _trend_${key} columns ignoring nulls", () => {
    const config: PlotConfig = {
      id: "plot-line-trend",
      title: "Line Chart with Trend",
      plotType: "line",
      primaryTableId: sampleTable.id,
      xAxisCol: "Month",
      yAxisCols: ["Revenue", "Profit"],
      aggregation: "none",
      theme: "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      trendline: "linear",
      createdAt: Date.now(),
    };

    const prepared = prepareChartData(config, tablesMap);

    // Each row should have _trend_Revenue and _trend_Profit calculated
    assert.ok(prepared.chartData[0]["_trend_Revenue"] !== undefined);
    assert.ok(prepared.chartData[0]["_trend_Profit"] !== undefined);

    // Check that trend points are numbers even for rows where the original series value was null
    // (e.g. Month 2 where Profit was null, and Month 3 where Revenue was null)
    const row2 = prepared.chartData[1]; // Month 2
    assert.equal(row2["Profit"], null);
    assert.ok(typeof row2["_trend_Profit"] === "number", "Trend should be predicted even when value was null");

    const row3 = prepared.chartData[2]; // Month 3
    assert.equal(row3["Revenue"], null);
    assert.ok(typeof row3["_trend_Revenue"] === "number", "Trend should be predicted even when value was null");
  });

  test("handles categorical/date string X axis in line charts by mapping to index", () => {
    const tableWithDateX: ParsedTable = {
      id: "table-dates",
      fileName: "dates.csv",
      fileType: "csv",
      uploadedAt: Date.now(),
      fileSize: 500,
      rowCount: 4,
      columns: [
        { name: "Date", type: "category", sampleValues: ["2025-01-01", "2025-01-02"], uniqueCount: 4, nonEmptyCount: 4 },
        { name: "Sales", type: "numeric", sampleValues: [10, 20, 30, 40], uniqueCount: 4, nonEmptyCount: 4 },
      ],
      rows: [
        { Date: "2025-01-01", Sales: 10 },
        { Date: "2025-01-02", Sales: 20 },
        { Date: "2025-01-03", Sales: 30 },
        { Date: "2025-01-04", Sales: 40 },
      ],
    };

    const config: PlotConfig = {
      id: "plot-cat-x",
      title: "Date X with Trend",
      plotType: "line",
      primaryTableId: tableWithDateX.id,
      xAxisCol: "Date",
      yAxisCols: ["Sales"],
      aggregation: "none",
      theme: "ink-minimal",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "linear",
      trendline: "linear",
      createdAt: Date.now(),
    };

    const prepared = prepareChartData(config, { [tableWithDateX.id]: tableWithDateX });

    assert.ok(prepared.chartData[0]["_trend_Sales"] !== undefined);
    assert.equal(prepared.chartData[0]["_trend_Sales"], 10);
    assert.equal(prepared.chartData[3]["_trend_Sales"], 40);
  });
});
