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
 * If valid or repairable, returns the normalized recommendation. Otherwise returns null.
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
  const colMap = new Map(profile.columns.map((c) => [c.name.toLowerCase(), c]));

  // 2. Validate xAxis column
  let xAxis = typeof rec.xAxis === "string" ? rec.xAxis.trim() : "";
  let xCol = colMap.get(xAxis.toLowerCase());
  if (!xCol) {
    // Attempt fallback to first date or category or first column
    const dateCol = profile.columns.find((c) => c.inferredType === "date");
    const catCol = profile.columns.find((c) => c.inferredType === "category");
    const fallback = dateCol || catCol || profile.columns[0];
    if (!fallback) return null;
    xAxis = fallback.name;
    xCol = fallback;
  }

  // 3. Validate yAxis column
  let yAxis = typeof rec.yAxis === "string" ? rec.yAxis.trim() : "";
  let yCol = colMap.get(yAxis.toLowerCase());
  if (!yCol || yCol.inferredType !== "numeric") {
    // Pick first numeric column
    const numCol = profile.columns.find((c) => c.inferredType === "numeric");
    if (!numCol) return null;
    yAxis = numCol.name;
    yCol = numCol;
  }

  // 4. Validate and repair plotType
  let plotType: PlotType = VALID_PLOT_TYPES.has(rec.plotType) ? rec.plotType : "bar";

  // Check plotType constraints
  if (plotType === "scatter") {
    // Scatter requires numeric x-axis
    if (xCol.inferredType !== "numeric") {
      plotType = "bar"; // gracefully repair to bar chart
    }
  } else if (plotType === "pie") {
    // Pie requires categorical x-axis with low/medium cardinality
    if (xCol.uniqueCount > 15 || xCol.inferredType === "numeric") {
      plotType = "bar";
    }
  } else if (plotType === "histogram") {
    if (xCol.inferredType !== "numeric") {
      xAxis = yAxis;
    }
  }

  // 5. Cross-file validation
  let secondaryFileIndex: number | null = null;
  let secondaryYAxis: string | null = null;

  if (
    typeof rec.secondaryFileIndex === "number" &&
    rec.secondaryFileIndex >= 0 &&
    rec.secondaryFileIndex < profiles.length &&
    rec.secondaryFileIndex !== fileIndex
  ) {
    // Check if cross-file compatibility is confirmed
    const isCompatible = crossFileCompatibility.some(
      (c) =>
        c.compatible &&
        ((c.file1Index === fileIndex && c.file2Index === rec.secondaryFileIndex) ||
          (c.file2Index === fileIndex && c.file1Index === rec.secondaryFileIndex))
    );

    if (isCompatible) {
      const secProfile = profiles[rec.secondaryFileIndex];
      const secColMap = new Map(secProfile.columns.map((c) => [c.name.toLowerCase(), c]));
      const requestedSecY = typeof rec.secondaryYAxis === "string" ? rec.secondaryYAxis.trim() : "";
      const secYCol = secColMap.get(requestedSecY.toLowerCase());

      if (secYCol && secYCol.inferredType === "numeric") {
        secondaryFileIndex = rec.secondaryFileIndex;
        secondaryYAxis = secYCol.name;
      } else {
        const firstNumSec = secProfile.columns.find((c) => c.inferredType === "numeric");
        if (firstNumSec) {
          secondaryFileIndex = rec.secondaryFileIndex;
          secondaryYAxis = firstNumSec.name;
        }
      }
    }
  }

  // 6. Aggregation
  let aggregation: any = rec.aggregation;
  if (!VALID_AGGREGATIONS.has(aggregation)) {
    aggregation = plotType === "pie" || plotType === "bar" ? "sum" : "none";
  }

  // 7. Sanitize analytical claims in title and description
  let title = typeof rec.title === "string" && rec.title.trim().length > 0
    ? rec.title.trim()
    : `${yAxis} by ${xAxis}`;

  let description = typeof rec.description === "string" && rec.description.trim().length > 0
    ? rec.description.trim()
    : `Visual representation of ${yAxis} along ${xAxis}.`;

  // Filter misleading causation words
  description = description
    .replace(/\bcauses\b/gi, "is associated with")
    .replace(/\bproves\b/gi, "indicates")
    .replace(/\bcausality\b/gi, "association");

  let reason = typeof rec.reason === "string" && rec.reason.trim().length > 0
    ? rec.reason.trim()
    : `Recommended based on ${xCol.inferredType} dimension and ${yCol.inferredType} measure.`;

  return {
    title,
    description,
    plotType,
    fileIndex,
    xAxis,
    yAxis,
    categoryAxis: rec.categoryAxis || undefined,
    secondaryFileIndex,
    secondaryYAxis,
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
