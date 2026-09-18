import {
  CrossFileCompatibility,
  DatasetProfile,
  VisualizationRecommendation,
} from "./types";

/**
 * Deterministic recommendation engine that generates rigorous visualization suggestions
 * strictly based on data types, cardinalities, distributions, and calculated statistics.
 */
export function generateDeterministicRecommendations(
  profiles: DatasetProfile[],
  crossFileCompatibility: CrossFileCompatibility[]
): VisualizationRecommendation[] {
  const recommendations: VisualizationRecommendation[] = [];

  profiles.forEach((profile, fileIndex) => {
    const cols = profile.columns;
    const dateCols = cols.filter((c) => c.inferredType === "date");
    const numCols = cols.filter((c) => c.inferredType === "numeric");
    const catCols = cols.filter((c) => c.inferredType === "category");
    const correlations = profile.correlations;

    // 1. Time-series Line or Area Plot (if date column exists)
    if (dateCols.length > 0 && numCols.length > 0) {
      const primaryDate = dateCols[0];
      const primaryNum = numCols[0];
      const temporalRel = profile.temporalRelationships.find(
        (t) => t.dateCol === primaryDate.name && t.numericCol === primaryNum.name
      );

      recommendations.push({
        title: `${primaryNum.name} over ${primaryDate.name}`,
        description: `Tracks chronological movement of ${primaryNum.name} across ${primaryDate.name}.${
          temporalRel ? ` Observed ${temporalRel.trend} pattern.` : ""
        }`,
        plotType: "line",
        fileIndex,
        xAxis: primaryDate.name,
        yAxis: primaryNum.name,
        aggregation: profile.rowCount > 50 ? "mean" : "none",
        chartTheme: "amber-craft",
        reason: `Temporal data detected with ${primaryDate.dateStats?.approximateGranularity || "standard"} intervals. Line charts best portray continuity over time.`,
        analyticalBasis: `Span: ${primaryDate.dateStats?.spanDays ?? "n/a"} days, valid data points: ${primaryNum.numericStats?.validCount ?? profile.rowCount}.`,
      });
    }

    // 2. Categorical Comparison (Bar Plot)
    if (catCols.length > 0 && numCols.length > 0) {
      // Pick category with sensible cardinality (2 to 15)
      const bestCat =
        catCols.find((c) => c.uniqueCount >= 2 && c.uniqueCount <= 12) || catCols[0];
      const bestNum =
        numCols.length > 1 ? numCols[1] : numCols[0];

      recommendations.push({
        title: `${bestNum.name} by ${bestCat.name}`,
        description: `Compares aggregated ${bestNum.name} values across distinct ${bestCat.name} groups.`,
        plotType: "bar",
        fileIndex,
        xAxis: bestCat.name,
        yAxis: bestNum.name,
        aggregation: "sum",
        chartTheme: "studio-slate",
        reason: `Categorical dimension '${bestCat.name}' with ${bestCat.uniqueCount} unique segments paired with quantitative measure '${bestNum.name}'.`,
        analyticalBasis: `Top category: ${bestCat.categoricalStats?.topValues[0]?.value || "N/A"} (${bestCat.categoricalStats?.topValues[0]?.percentage || 0}%).`,
      });
    }

    // 3. Scatter Plot for Correlated Numeric Pairs
    if (correlations.length > 0) {
      const topCorr = correlations[0];
      recommendations.push({
        title: `${topCorr.col1} vs ${topCorr.col2}`,
        description: `Examines bivariate association between ${topCorr.col1} and ${topCorr.col2}.`,
        plotType: "scatter",
        fileIndex,
        xAxis: topCorr.col1,
        yAxis: topCorr.col2,
        aggregation: "none",
        chartTheme: "indigo-night",
        reason: `Bivariate numeric relationship: Pearson correlation coefficient r = ${topCorr.pearsonR.toFixed(
          2
        )} (sample size n = ${topCorr.sampleSize}).`,
        analyticalBasis: topCorr.description,
      });
    } else if (numCols.length >= 2) {
      // Fallback scatter if at least two numeric columns
      recommendations.push({
        title: `${numCols[0].name} vs ${numCols[1].name}`,
        description: `Displays bivariate distribution between ${numCols[0].name} and ${numCols[1].name}.`,
        plotType: "scatter",
        fileIndex,
        xAxis: numCols[0].name,
        yAxis: numCols[1].name,
        aggregation: "none",
        chartTheme: "indigo-night",
        reason: "Two continuous quantitative measures allow inspection of variance and potential clustering.",
        analyticalBasis: `Ranges: [${numCols[0].numericStats?.min}..${numCols[0].numericStats?.max}] vs [${numCols[1].numericStats?.min}..${numCols[1].numericStats?.max}].`,
      });
    }

    // 4. Part-to-Whole Pie Chart (Strict: ONLY if low cardinality 3-7 and positive values)
    const pieCandidateCat = catCols.find(
      (c) => c.uniqueCount >= 3 && c.uniqueCount <= 7
    );
    if (pieCandidateCat && numCols.length > 0) {
      const pieNum = numCols[0];
      const hasNegatives = (pieNum.numericStats?.negativesCount || 0) > 0;
      if (!hasNegatives) {
        recommendations.push({
          title: `Share of ${pieNum.name} by ${pieCandidateCat.name}`,
          description: `Displays percentage breakdown of total ${pieNum.name} across ${pieCandidateCat.name}.`,
          plotType: "pie",
          fileIndex,
          xAxis: pieCandidateCat.name,
          yAxis: pieNum.name,
          aggregation: "sum",
          chartTheme: "amber-craft",
          reason: `Low cardinality (${pieCandidateCat.uniqueCount} segments) and strictly non-negative values satisfy statistical criteria for proportional pie charts.`,
          analyticalBasis: `Constituent categories: ${pieCandidateCat.categoricalStats?.topValues.map((v) => v.value).join(", ")}.`,
        });
      }
    }

    // 5. Histogram for continuous metric with notable distribution
    if (numCols.length > 0 && profile.rowCount >= 10) {
      const metricForHist =
        numCols.find((c) => (c.numericStats?.possibleOutliersCount || 0) > 0) || numCols[0];

      recommendations.push({
        title: `Distribution of ${metricForHist.name}`,
        description: `Visualizes frequency density and dispersion across value bins for ${metricForHist.name}.`,
        plotType: "histogram",
        fileIndex,
        xAxis: metricForHist.name,
        yAxis: metricForHist.name,
        aggregation: "count",
        chartTheme: "sage-forest",
        reason: `Inspects spread, skewness (${metricForHist.numericStats?.skewness ?? "n/a"}), and ${
          metricForHist.numericStats?.possibleOutliersCount ?? 0
        } possible outlier values.`,
        analyticalBasis: `Mean: ${metricForHist.numericStats?.mean}, Median: ${metricForHist.numericStats?.median}, IQR: ${metricForHist.numericStats?.iqr}.`,
      });
    }
  });

  // 6. Cross-File Visualization (Strict: ONLY if compatibility analyzer found verified join keys)
  const verifiedCompatibility = crossFileCompatibility.find((c) => c.compatible);
  if (verifiedCompatibility && profiles.length >= 2) {
    const p1 = profiles[verifiedCompatibility.file1Index];
    const p2 = profiles[verifiedCompatibility.file2Index];
    const joinKey = verifiedCompatibility.commonKeyCandidates[0]?.split(" ~ ")[0];

    const num1 = p1.columns.find((c) => c.inferredType === "numeric");
    const num2 = p2.columns.find((c) => c.inferredType === "numeric");

    if (joinKey && num1 && num2) {
      recommendations.push({
        title: `Cross-Dataset: ${num1.name} & ${num2.name}`,
        description: `Correlates ${num1.name} from '${p1.fileName}' with ${num2.name} from '${p2.fileName}' aligned on shared '${joinKey}'.`,
        plotType: "composed",
        fileIndex: verifiedCompatibility.file1Index,
        xAxis: joinKey,
        yAxis: num1.name,
        secondaryFileIndex: verifiedCompatibility.file2Index,
        secondaryYAxis: num2.name,
        aggregation: "none",
        chartTheme: "amber-craft",
        reason: `Schema validation confirmed compatible dimension '${joinKey}' across both datasets.`,
        analyticalBasis: `Common keys identified: ${verifiedCompatibility.commonKeyCandidates.join(", ")}.`,
      });
    }
  }

  // Deduplicate and cap at 6 recommendations
  const seenKeys = new Set<string>();
  const uniqueRecs: VisualizationRecommendation[] = [];

  for (const rec of recommendations) {
    const key = `${rec.plotType}-${rec.fileIndex}-${rec.xAxis}-${rec.yAxis}-${rec.secondaryFileIndex ?? ""}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRecs.push(rec);
    }
  }

  return uniqueRecs.slice(0, 6);
}
