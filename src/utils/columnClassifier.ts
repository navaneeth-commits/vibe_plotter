import { ColumnMeta, ColumnType } from "../types";

/**
 * Checks if a string or number represents a valid date or timestamp
 */
function isDateValue(val: any): boolean {
  if (val === null || val === undefined || val === "") return false;
  if (val instanceof Date && !isNaN(val.getTime())) return true;
  if (typeof val === "number") {
    // 4-digit years like 2020..2030 can be years, but might also be integers
    if (val >= 1950 && val <= 2050 && Number.isInteger(val)) return true;
    return false;
  }
  if (typeof val !== "string") return false;

  const s = val.trim();
  if (s.length < 4 || s.length > 35) return false;

  // Common date regex patterns: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, Q1 2024, etc.
  const dateRegex = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}\s*-\s*[Qq][1-4]|Q[1-4]\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/ ]\d{2,4})$/i;
  if (dateRegex.test(s)) return true;

  // Test parsed timestamp
  const parsed = Date.parse(s);
  if (!isNaN(parsed) && !/^\d+$/.test(s)) {
    // Avoid pure numbers that parse as epoch millis unless clearly formatted
    const dateObj = new Date(parsed);
    const year = dateObj.getFullYear();
    if (year >= 1970 && year <= 2100) return true;
  }
  return false;
}

/**
 * Checks if a value is cleanly numeric (allowing commas, percent, currency symbols)
 */
function parseNumericValue(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val === "string") {
    const clean = val.trim().replace(/^[$\u20AC\u00A3\u00A5]/, "").replace(/%$/, "").replace(/,/g, "");
    if (clean === "") return null;
    const num = Number(clean);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Checks if column name implies an ID or unique index
 */
function isIdColumnName(colName: string): boolean {
  const lower = colName.toLowerCase().replace(/[_\s-]/g, "");
  return (
    lower === "id" ||
    lower.endsWith("id") ||
    lower === "uuid" ||
    lower === "guid" ||
    lower === "code" ||
    lower === "sku" ||
    lower === "index" ||
    lower === "key" ||
    lower === "ref" ||
    lower === "#" ||
    lower === "recordid" ||
    lower === "rowid"
  );
}

/**
 * Classifies all columns in a table and groups/orders them:
 * Numeric cols, Date/time cols, ID cols, Category cols
 */
export function classifyColumns(rows: Record<string, any>[]): ColumnMeta[] {
  if (!rows || rows.length === 0) return [];

  // Gather all unique column names
  const colNamesSet = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r || {}).forEach((k) => colNamesSet.add(k));
  });
  const colNames = Array.from(colNamesSet);

  const metas: ColumnMeta[] = colNames.map((name) => {
    const nonEmpties = rows
      .map((r) => r[name])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

    const totalNonEmpty = nonEmpties.length;
    const sampleValues = nonEmpties.slice(0, 5).map((v) => (typeof v === "object" ? JSON.stringify(v) : v));
    const uniqueValues = new Set(nonEmpties.map((v) => String(v).trim()));
    const uniqueCount = uniqueValues.size;

    if (totalNonEmpty === 0) {
      return {
        name,
        type: "category",
        sampleValues: [],
        uniqueCount: 0,
        nonEmptyCount: 0,
      };
    }

    // Check ID heuristic
    const isIdByName = isIdColumnName(name);
    if (isIdByName && (uniqueCount >= totalNonEmpty * 0.9 || totalNonEmpty < 10)) {
      return {
        name,
        type: "id",
        sampleValues,
        uniqueCount,
        nonEmptyCount: totalNonEmpty,
      };
    }

    // Check Date
    let dateCount = 0;
    for (const val of nonEmpties) {
      if (isDateValue(val)) dateCount++;
    }
    if (dateCount / totalNonEmpty >= 0.7) {
      return {
        name,
        type: "date",
        sampleValues,
        uniqueCount,
        nonEmptyCount: totalNonEmpty,
      };
    }

    // Check Numeric
    let numCount = 0;
    const numValues: number[] = [];
    for (const val of nonEmpties) {
      const parsed = parseNumericValue(val);
      if (parsed !== null) {
        numCount++;
        numValues.push(parsed);
      }
    }

    if (numCount / totalNonEmpty >= 0.75) {
      // If it has 100% unique integers and column name sounds like ID/code, flag as ID
      if (isIdByName || (uniqueCount === totalNonEmpty && /^\d+$/.test(name))) {
        return {
          name,
          type: "id",
          sampleValues,
          uniqueCount,
          nonEmptyCount: totalNonEmpty,
        };
      }

      const minVal = numValues.length > 0 ? Math.min(...numValues) : undefined;
      const maxVal = numValues.length > 0 ? Math.max(...numValues) : undefined;

      return {
        name,
        type: "numeric",
        sampleValues: numValues.slice(0, 5),
        min: minVal,
        max: maxVal,
        uniqueCount,
        nonEmptyCount: totalNonEmpty,
      };
    }

    // Otherwise categorical
    return {
      name,
      type: "category",
      sampleValues,
      uniqueCount,
      nonEmptyCount: totalNonEmpty,
    };
  });

  // Sort columns in the requested order:
  // 1. Numeric cols
  // 2. Date type cols
  // 3. Category cols
  // 4. ID cols
  const typeOrderPriority: Record<ColumnType, number> = {
    numeric: 1,
    date: 2,
    category: 3,
    id: 4,
  };

  return metas.sort((a, b) => {
    const priA = typeOrderPriority[a.type];
    const priB = typeOrderPriority[b.type];
    if (priA !== priB) return priA - priB;
    return a.name.localeCompare(b.name);
  });
}
