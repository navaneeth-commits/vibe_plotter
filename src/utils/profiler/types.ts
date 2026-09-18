export type ColumnType =
  | "numeric"
  | "date"
  | "id"
  | "category"
  | "boolean"
  | "text";

export interface NumericStatistics {
  count: number;
  validCount: number;
  nullCount: number;
  nullPercentage: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standardDeviation: number;
  q1: number;
  q3: number;
  iqr: number;
  zerosCount: number;
  negativesCount: number;
  possibleOutliersCount: number;
  sampleOutliers: number[];
  skewness: number | null;
}

export interface CategoricalStatistics {
  count: number;
  validCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  topValues: Array<{ value: string; count: number; percentage: number }>;
  isBinary: boolean;
  mode: string | null;
}

export interface DateStatistics {
  count: number;
  validCount: number;
  nullCount: number;
  nullPercentage: number;
  minDate: string | null;
  maxDate: string | null;
  spanDays: number | null;
  approximateGranularity: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "irregular";
  isChronological: boolean;
}

export interface ColumnProfile {
  name: string;
  inferredType: ColumnType;
  rowCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  sampleValues: (string | number | boolean)[];
  numericStats?: NumericStatistics;
  categoricalStats?: CategoricalStatistics;
  dateStats?: DateStatistics;
}

export type CorrelationStrength =
  | "strong_positive"
  | "moderate_positive"
  | "weak"
  | "moderate_negative"
  | "strong_negative";

export interface CorrelationPair {
  col1: string;
  col2: string;
  pearsonR: number;
  spearmanR?: number;
  sampleSize: number;
  strength: CorrelationStrength;
  description: string;
}

export interface GroupRelationship {
  categoryCol: string;
  numericCol: string;
  groupCount: number;
  description: string;
}

export interface TemporalRelationship {
  dateCol: string;
  numericCol: string;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  description: string;
}

export interface DataQualityReport {
  totalRows: number;
  duplicateRowsCount: number;
  overallCompletenessPct: number;
  columnsWithNulls: Array<{ column: string; nullCount: number; nullPct: number }>;
  outliersSummary: Array<{ column: string; outlierCount: number }>;
  qualityNotes: string[];
}

export interface DatasetProfile {
  tableId: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  correlations: CorrelationPair[];
  groupRelationships: GroupRelationship[];
  temporalRelationships: TemporalRelationship[];
  dataQuality: DataQualityReport;
}

export interface CrossFileCompatibility {
  compatible: boolean;
  file1Index: number;
  file2Index: number;
  file1Name: string;
  file2Name: string;
  commonColumns: string[];
  commonKeyCandidates: string[];
  compatibleDateColumns: string[];
  reason: string;
}

export type PlotType =
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "radar"
  | "histogram"
  | "composed";

export type AggregationType = "none" | "sum" | "mean" | "count" | "min" | "max";

export type ChartTheme =
  | "amber-craft"
  | "ink-minimal"
  | "sage-forest"
  | "studio-slate"
  | "indigo-night"
  | "sunset-coral";

export interface VisualizationRecommendation {
  title: string;
  description: string;
  plotType: PlotType;
  fileIndex: number;
  xAxis: string;
  yAxis: string;
  categoryAxis?: string | null;
  secondaryFileIndex?: number | null;
  secondaryYAxis?: string | null;
  aggregation?: AggregationType;
  chartTheme?: ChartTheme;
  reason: string;
  analyticalBasis?: string;
}

export interface AnalysisApiResponse {
  source: "gemini" | "deterministic";
  message?: string;
  domainSummary: string;
  keyObservations: string[];
  dataQuality: Record<string, DataQualityReport>;
  profiles: DatasetProfile[];
  crossFileAnalysis: CrossFileCompatibility[];
  recommendations: VisualizationRecommendation[];
}
