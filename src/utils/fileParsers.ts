import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import { ParsedTable } from "../types";
import { classifyColumns } from "./columnClassifier";

// Set pdfjs worker source if needed for browser
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Extracts tabular text from PDF file
 */
async function parsePdfTable(file: File): Promise<{ rows: Record<string, any>[]; columns: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const rawLines: string[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    // Group items by Y coordinate (within 4px tolerance) to form visual rows
    const lineMap = new Map<number, Array<{ text: string; x: number }>>();

    for (const item of items) {
      if (!item.str || item.str.trim() === "") continue;
      const x = item.transform[4];
      const y = Math.round(item.transform[5] / 4) * 4; // snap to nearest 4px

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({ text: item.str.trim(), x });
    }

    // Sort lines descending by Y (top of page to bottom)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const lineItems = lineMap.get(y)!;
      // Sort tokens left to right by X
      lineItems.sort((a, b) => a.x - b.x);

      // Check if line contains tabular tokens (separated by distance or tabs)
      const tokens = lineItems.map((t) => t.text);
      if (tokens.length >= 2) {
        rawLines.push(tokens);
      } else if (tokens.length === 1) {
        // Maybe comma or tab separated inside single string
        const split = tokens[0].split(/[,\t|]+/);
        if (split.length >= 2) {
          rawLines.push(split.map((s) => s.trim()));
        }
      }
    }
  }

  if (rawLines.length < 2) {
    throw new Error("No structured tabular data could be extracted from this PDF. Please ensure the PDF contains clear table columns.");
  }

  // The first line is treated as header
  const headers = rawLines[0].map((h, idx) => (h ? h.replace(/[^a-zA-Z0-9_ ]/g, "").trim() || `Column_${idx + 1}` : `Column_${idx + 1}`));
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < rawLines.length; r++) {
    const line = rawLines[r];
    const rowObj: Record<string, any> = {};
    headers.forEach((hdr, colIdx) => {
      rowObj[hdr] = line[colIdx] !== undefined ? line[colIdx] : "";
    });
    rows.push(rowObj);
  }

  return { rows, columns: headers };
}

/**
 * Main parser entry point handling CSV, TSV, XLSX, XLS, PDF, and JSON
 */
export async function parseUploadedFile(file: File): Promise<ParsedTable> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  let rows: Record<string, any>[] = [];
  let fileType: ParsedTable["fileType"] = "csv";

  if (extension === "pdf") {
    fileType = "pdf";
    const pdfData = await parsePdfTable(file);
    rows = pdfData.rows;
  } else if (extension === "json") {
    fileType = "json";
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
      rows = parsed.data;
    } else if (parsed && typeof parsed === "object") {
      // Find first array property
      const arrKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      if (arrKey) {
        rows = parsed[arrKey];
      } else {
        throw new Error("JSON file does not contain a recognizable list of table records.");
      }
    }
  } else {
    // Excel or CSV/TSV
    if (extension === "xlsx" || extension === "xls") {
      fileType = "xlsx";
    } else if (extension === "tsv") {
      fileType = "tsv";
    } else {
      fileType = "csv";
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true,
      raw: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Spreadsheet contains no sheets.");
    }
    const worksheet = workbook.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  }

  if (!rows || rows.length === 0) {
    throw new Error(`No data rows detected in ${file.name}. Ensure the file contains header columns and non-empty rows.`);
  }

  // Sanitize row data types: trim string keys, parse stringified numbers if appropriate
  const cleanedRows = rows.map((r) => {
    const cleanObj: Record<string, any> = {};
    Object.entries(r).forEach(([k, v]) => {
      const cleanKey = k.trim();
      if (!cleanKey) return;
      if (typeof v === "string") {
        const trimmed = v.trim();
        // If it looks like a number without leading zero (unless '0' or '0.xx')
        if (/^-?\d+(\.\d+)?$/.test(trimmed) && !/^0\d+/.test(trimmed)) {
          cleanObj[cleanKey] = Number(trimmed);
        } else {
          cleanObj[cleanKey] = trimmed;
        }
      } else {
        cleanObj[cleanKey] = v;
      }
    });
    return cleanObj;
  });

  const columns = classifyColumns(cleanedRows);

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    fileName: file.name,
    fileSize: file.size,
    fileType,
    columns,
    rows: cleanedRows,
    rowCount: cleanedRows.length,
    uploadedAt: Date.now(),
  };
}
