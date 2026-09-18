import {
  ColumnProfile,
  DataQualityReport,
  DatasetProfile,
  CrossFileCompatibility,
  VisualizationRecommendation,
  AnalysisApiResponse,
} from "./utils/profiler/types";

export * from "./utils/profiler/types";

export interface ColumnMeta {
  name: string;
  type: "numeric" | "date" | "id" | "category" | "boolean" | "text";
  sampleValues: (string | number | boolean)[];
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  uniqueCount: number;
  nonEmptyCount: number;
  nullCount?: number;
  inferredFormat?: string;
  profile?: ColumnProfile;
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
  profile?: DatasetProfile;
  dataQuality?: DataQualityReport;
}

export type ImageFormat = "png" | "jpeg" | "jpg";

export interface PlotConfig {
  id: string;
  title: string;
  description?: string;
  plotType:
    | "bar"
    | "line"
    | "area"
    | "scatter"
    | "pie"
    | "radar"
    | "histogram"
    | "composed";
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

  aggregation: "none" | "sum" | "mean" | "count" | "min" | "max";
  theme:
    | "amber-craft"
    | "ink-minimal"
    | "sage-forest"
    | "studio-slate"
    | "indigo-night"
    | "sunset-coral";
  showGrid: boolean;
  showLegend: boolean;
  showDataPoints: boolean;
  curveType: "monotone" | "linear" | "step";
  createdAt: number;
}

// Aliases for compatibility
export type AIRecommendation = VisualizationRecommendation;
export type AIAnalysisResponse = AnalysisApiResponse;
