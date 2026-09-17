export type ColumnType = "numeric" | "date" | "id" | "category";

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  sampleValues: (string | number)[];
  min?: number;
  max?: number;
  uniqueCount: number;
  nonEmptyCount: number;
  inferredFormat?: string;
}

export interface ParsedTable {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: "csv" | "xlsx" | "pdf" | "tsv" | "json" | "sample";
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  rowCount: number;
  uploadedAt: number;
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

export type ChartTheme =
  | "amber-craft"
  | "ink-minimal"
  | "sage-forest"
  | "studio-slate"
  | "indigo-night"
  | "sunset-coral";

export type AggregationType = "none" | "sum" | "mean" | "count" | "min" | "max";

export type ImageFormat = "png" | "jpeg" | "jpg";

export interface PlotConfig {
  id: string;
  title: string;
  description?: string;
  plotType: PlotType;
  primaryTableId: string;
  xAxisCol: string;
  yAxisCols: string[];
  categoryCol?: string; // Grouping / hue / stack
  
  // Cross-file plotting
  isCrossFile?: boolean;
  secondaryTableId?: string;
  secondaryYAxisCol?: string;
  joinMethod?: "index" | "match_key";
  matchKeyPrimary?: string;
  matchKeySecondary?: string;

  aggregation: AggregationType;
  theme: ChartTheme;
  showGrid: boolean;
  showLegend: boolean;
  showDataPoints: boolean;
  curveType: "monotone" | "linear" | "step";
  createdAt: number;
}

export interface AIRecommendation {
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
}

export interface AIAnalysisResponse {
  source: "gemini" | "fallback";
  message?: string;
  domainSummary?: string;
  keyObservations?: string[];
  recommendations: AIRecommendation[];
}
