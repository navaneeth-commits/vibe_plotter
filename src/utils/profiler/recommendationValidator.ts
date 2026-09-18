import {
  CrossFileCompatibility,
  DatasetProfile,
  PlotType,
  VisualizationRecommendation,
} from "./types";
import { generateDeterministicRecommendations } from "./recommendationEngine";

const VALID_PLOT_TYPES: Set<PlotType> = new Set([
  "bar",
  "line",
  "area",
  "scatter",
  "pie",
  "radar",
  "histogram",
  "composed",
]);

const VALID_AGGREGATIONS = new Set(["none", "sum", "mean", "count", "min", "max"]);

/**
 * Validates a single recommendation against the actual dataset profiles.
 * Discards recommendations that hallucinate columns, have invalid semantic axis types,
 * or violate chart constraints (e.g. pie with negatives or zero totals), allowing
 * the deterministic fallback engine to supply grounded alternatives.
 */
export function validateAndRepairRecommendation(
  rec: any,
  profiles: DatasetProfile[],
  crossFileCompatibility: CrossFileCompatibility[]
): VisualizationRecommendation | null {
  if (!rec || typeof rec !== "object") return null;

  // 1. File index validation
  const fileIndex = typeof rec.fileIndex === "number" ? rec.fileIndex : 0;
  if (fileIndex < 0 || fileIndex >= profiles.length) return null;

  const profile = profiles[fileIndex];
  const colMap = new Map(profile.columns.map((c) => [c.name.toLowerCase().trim(), c]));

  // 2. Validate xAxis column - MUST exist in dataset; do NOT invent replacement columns
  const rawXAxis = typeof rec.xAxis === "string" ? rec.xAxis.trim() : "";
  if (!rawXAxis) return null;
  const xCol = colMap.get(rawXAxis.toLowerCase());
  if (!xCol) return null;
  const xAxis = xCol.name;

  // 3. Validate yAxis column - MUST exist and be numeric; do NOT invent replacement columns
  const rawYAxis = typeof rec.yAxis === "string" ? rec.yAxis.trim() : "";
  if (!rawYAxis) return null;
  const yCol = colMap.get(rawYAxis.toLowerCase());
  if (!yCol || yCol.inferredType !== "numeric") return null;
  const yAxis = yCol.name;

  // 4. Validate plotType against allowed types
  if (!VALID_PLOT_TYPES.has(rec.plotType)) return null;
  const plotType: PlotType = rec.plotType;

  // Strict semantic constraints per chart type:
  if (plotType === "scatter") {
    // Scatter plot strictly requires numeric continuous x-axis
    if (xCol.inferredType !== "numeric") {
      return null;
    }
  } else if (plotType === "histogram") {
    // Histogram strictly requires continuous numeric column
    if (xCol.inferredType !== "numeric" || xCol.uniqueCount < 4) {
      return null;
    }
  } else if (plotType === "pie") {
    // Pie requires 3–7 categories, non-numeric/non-id axis, no negative values, and positive total
    if (xCol.uniqueCount < 3 || xCol.uniqueCount > 7) {
      return null;
    }
    if (xCol.inferredType === "numeric" || xCol.inferredType === "id") {
      return null;
    }
    const hasNegatives = (yCol.numericStats?.negativesCount || 0) > 0;
    if (hasNegatives) {
      return null;
    }
    const maxVal = yCol.numericStats?.max || 0;
    const sumVal = yCol.numericStats?.sum ?? 0;
    const meanVal = yCol.numericStats?.mean ?? 0;
    // Disallow all-zero or non-positive total
    if (maxVal <= 0 || (sumVal <= 0 && meanVal <= 0)) {
      return null;
    }
  } else if (plotType === "bar" || plotType === "line") {
    // Disallow direct plotting of high-cardinality ID columns
    if (xCol.inferredType === "id" && xCol.uniqueCount > 20) {
      return null;
    }
  }

  // 5. Cross-file validation
  let secondaryFileIndex: number | null = null;
  let secondaryYAxis: string | null = null;
  let matchKeyPrimary: string | null = null;
  let matchKeySecondary: string | null = null;

  if (
    typeof rec.secondaryFileIndex === "number" &&
    rec.secondaryFileIndex >= 0 &&
    rec.secondaryFileIndex < profiles.length &&
    rec.secondaryFileIndex !== fileIndex
  ) {
    // Verify cross-file compatibility is explicitly confirmed with valid keys
    const compat = crossFileCompatibility.find(
      (c) =>
        c.compatible &&
        ((c.file1Index === fileIndex && c.file2Index === rec.secondaryFileIndex) ||
          (c.file2Index === fileIndex && c.file1Index === rec.secondaryFileIndex))
    );

    if (compat && compat.primaryKey && compat.secondaryKey) {
      const secProfile = profiles[rec.secondaryFileIndex];
      const secColMap = new Map(secProfile.columns.map((c) => [c.name.toLowerCase().trim(), c]));
      const requestedSecY = typeof rec.secondaryYAxis === "string" ? rec.secondaryYAxis.trim() : "";
      const secYCol = secColMap.get(requestedSecY.toLowerCase());

      if (secYCol && secYCol.inferredType === "numeric") {
        secondaryFileIndex = rec.secondaryFileIndex;
        secondaryYAxis = secYCol.name;
        matchKeyPrimary = compat.file1Index === fileIndex ? compat.primaryKey : compat.secondaryKey;
        matchKeySecondary = compat.file1Index === fileIndex ? compat.secondaryKey : compat.primaryKey;
      }
    }
  }

  // 6. Validate Category Axis (if specified)
  let categoryAxis: string | undefined = undefined;
  if (typeof rec.categoryAxis === "string" && rec.categoryAxis.trim().length > 0) {
    const catCol = colMap.get(rec.categoryAxis.trim().toLowerCase());
    if (catCol && (catCol.inferredType === "category" || catCol.inferredType === "id")) {
      categoryAxis = catCol.name;
    }
  }

  // 7. Aggregation normalization
  let aggregation: any = rec.aggregation;
  if (!VALID_AGGREGATIONS.has(aggregation)) {
    aggregation = plotType === "pie" ? "sum" : "none";
  }

  // 8. Sanitize analytical claims in title and description
  const title = typeof rec.title === "string" && rec.title.trim().length > 0
    ? rec.title.trim()
    : `${yAxis} by ${xAxis}`;

  let description = typeof rec.description === "string" && rec.description.trim().length > 0
    ? rec.description.trim()
    : `Visual representation of ${yAxis} along ${xAxis}.`;

  // Filter misleading causation words
  description = description
    .replace(/\bcauses\b/gi, "is associated with")
    .replace(/\bproves\b/gi, "indicates")
    .replace(/\bcausality\b/gi, "association")
    .replace(/\bdetermines\b/gi, "corresponds to")
    .replace(/\bdrives\b/gi, "relates to");

  // If correlation is mentioned, verify that correlation was computed between these axes
  const hasCorrelation = profile.correlations.some(
    (c) =>
      (c.col1.toLowerCase() === xAxis.toLowerCase() && c.col2.toLowerCase() === yAxis.toLowerCase()) ||
      (c.col2.toLowerCase() === xAxis.toLowerCase() && c.col1.toLowerCase() === yAxis.toLowerCase())
  );
  if (!hasCorrelation && plotType !== "scatter") {
    description = description
      .replace(/\bcorrelated\b/gi, "associated")
      .replace(/\bcorrelation\b/gi, "relationship")
      .replace(/\bcorrelates with\b/gi, "relates to");
  }

  const reason = typeof rec.reason === "string" && rec.reason.trim().length > 0
    ? rec.reason.trim()
    : `Recommended based on ${xCol.inferredType} dimension and ${yCol.inferredType} measure.`;

  return {
    title,
    description,
    plotType,
    fileIndex,
    xAxis,
    yAxis,
    categoryAxis,
    secondaryFileIndex,
    secondaryYAxis,
    matchKeyPrimary,
    matchKeySecondary,
    aggregation,
    chartTheme: rec.chartTheme || "amber-craft",
    reason,
    analyticalBasis: rec.analyticalBasis || undefined,
  };
}

/**
 * Validates a list of recommendations from Gemini or external input,
 * repairing recoverable recommendations and discarding invalid ones.
 * If too few valid recommendations remain, blends in deterministic ones.
 */
export function validateRecommendations(
  rawRecs: unknown[],
  profiles: DatasetProfile[],
  crossFileCompatibility: CrossFileCompatibility[]
): VisualizationRecommendation[] {
  if (!Array.isArray(rawRecs) || rawRecs.length === 0) {
    return generateDeterministicRecommendations(profiles, crossFileCompatibility);
  }

  const validated: VisualizationRecommendation[] = [];
  const seenKeys = new Set<string>();

  for (const raw of rawRecs) {
    const valid = validateAndRepairRecommendation(raw, profiles, crossFileCompatibility);
    if (valid) {
      const key = `${valid.plotType}-${valid.fileIndex}-${valid.xAxis}-${valid.yAxis}-${valid.secondaryFileIndex ?? ""}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        validated.push(valid);
      }
    }
  }

  // If fewer than 2 valid recommendations survived validation, augment with deterministic fallback
  if (validated.length < 2) {
    const fallbacks = generateDeterministicRecommendations(profiles, crossFileCompatibility);
    for (const fb of fallbacks) {
      const key = `${fb.plotType}-${fb.fileIndex}-${fb.xAxis}-${fb.yAxis}-${fb.secondaryFileIndex ?? ""}`;
      if (!seenKeys.has(key) && validated.length < 6) {
        seenKeys.add(key);
        validated.push(fb);
      }
    }
  }

  return validated.slice(0, 6);
}
