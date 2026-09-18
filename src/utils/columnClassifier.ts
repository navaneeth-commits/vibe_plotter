import { ColumnMeta, ColumnType } from "../types";
import { profileDataset } from "./profiler/statisticalProfiler";

/**
 * Classifies all columns in a table and groups/orders them with rich statistical metadata:
 * 1. Numeric cols
 * 2. Date type cols
 * 3. Category cols
 * 4. ID cols
 */
export function classifyColumns(rows: Record<string, any>[]): ColumnMeta[] {
  if (!rows || rows.length === 0) return [];

  const { profile } = profileDataset("temp", "temp", rows);

  const metas: ColumnMeta[] = profile.columns.map((col) => {
    // Map inferred types to standard types for UI
    let uiType: ColumnType = "category";
    if (col.inferredType === "numeric") uiType = "numeric";
    else if (col.inferredType === "date") uiType = "date";
    else if (col.inferredType === "id") uiType = "id";
    else uiType = "category";

    const meta: ColumnMeta = {
      name: col.name,
      type: uiType,
      sampleValues: col.sampleValues,
      min: col.numericStats?.min,
      max: col.numericStats?.max,
      mean: col.numericStats?.mean,
      median: col.numericStats?.median,
      stdDev: col.numericStats?.standardDeviation,
      uniqueCount: col.uniqueCount,
      nonEmptyCount: col.rowCount - col.nullCount,
      nullCount: col.nullCount,
      profile: col,
    };

    return meta;
  });

  const typeOrderPriority: Record<string, number> = {
    numeric: 1,
    date: 2,
    category: 3,
    id: 4,
    boolean: 3,
    text: 3,
  };

  return metas.sort((a, b) => {
    const priA = typeOrderPriority[a.type] || 5;
    const priB = typeOrderPriority[b.type] || 5;
    if (priA !== priB) return priA - priB;
    return a.name.localeCompare(b.name);
  });
}
