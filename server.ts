import express from "express";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  profileDataset,
  analyzeCorrelations,
  analyzeGroupRelationships,
  analyzeTemporalRelationships,
  analyzeCrossFileCompatibility,
  generateDeterministicRecommendations,
  validateRecommendations,
  DatasetProfile,
  DataQualityReport,
  CrossFileCompatibility,
  VisualizationRecommendation,
} from "./src/utils/profiler";
import { RawTablePayload } from "./src/types";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Model configuration
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Lazy initialization for Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "vibe-plotter",
    timestamp: new Date().toISOString(),
  });
});

const MAX_ROWS_PER_TABLE = 1000;

/**
 * Executes full deterministic profiling across all provided tables.
 */
function runDeterministicAnalysis(tables: RawTablePayload[]): {
  profiles: DatasetProfile[];
  dataQualityMap: Record<string, DataQualityReport>;
  crossFileAnalysis: CrossFileCompatibility[];
} {
  const profiles: DatasetProfile[] = [];
  const dataQualityMap: Record<string, DataQualityReport> = {};

  tables.forEach((t, idx) => {
    const tableId = t.id || `table_${idx}`;
    const fileName = t.fileName || `dataset_${idx + 1}.csv`;
    const rawRows = Array.isArray(t.rows) && t.rows.length > 0
      ? t.rows
      : Array.isArray(t.sampleRows)
      ? t.sampleRows
      : [];
    const rows: Record<string, any>[] = rawRows as Record<string, any>[];

    const { profile, dataQuality } = profileDataset(tableId, fileName, rows);

    // Compute correlations for numeric columns
    const numericCols = profile.columns
      .filter((c) => c.inferredType === "numeric")
      .map((c) => c.name);
    const categoryCols = profile.columns
      .filter((c) => c.inferredType === "category")
      .map((c) => c.name);
    const dateCols = profile.columns
      .filter((c) => c.inferredType === "date")
      .map((c) => c.name);

    profile.correlations = analyzeCorrelations(rows, numericCols);
    profile.groupRelationships = analyzeGroupRelationships(rows, categoryCols, numericCols);
    profile.temporalRelationships = analyzeTemporalRelationships(rows, dateCols, numericCols);

    profiles.push(profile);
    dataQualityMap[fileName] = dataQuality;
  });

  // Cross-file compatibility analysis for all pairs
  const crossFileAnalysis: CrossFileCompatibility[] = [];
  if (profiles.length >= 2) {
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const rows1 = (tables[i]?.rows || tables[i]?.sampleRows || []) as Record<string, any>[];
        const rows2 = (tables[j]?.rows || tables[j]?.sampleRows || []) as Record<string, any>[];
        const compat = analyzeCrossFileCompatibility(
          profiles[i],
          profiles[j],
          rows1,
          rows2,
          i,
          j
        );
        crossFileAnalysis.push(compat);
      }
    }
  }

  return { profiles, dataQualityMap, crossFileAnalysis };
}

/**
 * Builds a compact, rigorous statistical summary to send to Gemini.
 */
function buildAnalyticalPromptSummary(
  profiles: DatasetProfile[],
  crossFileAnalysis: CrossFileCompatibility[]
): string {
  const tableSummaries = profiles.map((p, idx) => {
    const colDetails = p.columns.map((c) => {
      let statsStr = "";
      if (c.inferredType === "numeric" && c.numericStats) {
        statsStr = ` | min=${c.numericStats.min}, max=${c.numericStats.max}, mean=${c.numericStats.mean}, median=${c.numericStats.median}, stdDev=${c.numericStats.standardDeviation}, outliers=${c.numericStats.possibleOutliersCount}`;
      } else if (c.inferredType === "category" && c.categoricalStats) {
        const top3 = c.categoricalStats.topValues.slice(0, 3).map((v) => `${v.value} (${v.percentage}%)`).join(", ");
        statsStr = ` | cardinality=${c.uniqueCount}, top: [${top3}]`;
      } else if (c.inferredType === "date" && c.dateStats) {
        statsStr = ` | range=[${c.dateStats.minDate}..${c.dateStats.maxDate}], span=${c.dateStats.spanDays} days, interval=${c.dateStats.approximateGranularity}`;
      }
      return `  * ${c.name} [${c.inferredType}] (nulls: ${c.nullPercentage}%)${statsStr}`;
    }).join("\n");

    const corrStr = p.correlations.length > 0
      ? p.correlations.slice(0, 4).map((c) => `  * Pearson r(${c.col1}, ${c.col2}) = ${c.pearsonR} (${c.strength}, n=${c.sampleSize})`).join("\n")
      : "  * No strong bivariate correlations detected.";

    const groupStr = p.groupRelationships.length > 0
      ? p.groupRelationships.map((g) => `  * ${g.description}`).join("\n")
      : "  * No notable group segmentation.";

    const tempStr = p.temporalRelationships.length > 0
      ? p.temporalRelationships.map((t) => `  * ${t.description}`).join("\n")
      : "  * No chronological series detected.";

    return `Dataset ${idx} ("${p.fileName}"):
- Rows: ${p.rowCount}, Columns: ${p.columnCount}
- Column Profiles:
${colDetails}
- Calculated Pearson Correlations:
${corrStr}
- Group Relationships:
${groupStr}
- Temporal Trends:
${tempStr}`;
  }).join("\n\n---\n\n");

  const crossFileStr = crossFileAnalysis.length > 0
    ? crossFileAnalysis.map((c) => `- File ${c.file1Index} ("${c.file1Name}") & File ${c.file2Index} ("${c.file2Name}"): ${c.reason}`).join("\n")
    : "Single dataset upload.";

  return `### PROFILED DATASETS:\n${tableSummaries}\n\n### CROSS-FILE COMPATIBILITY:\n${crossFileStr}`;
}

// Helper to validate table payload structure
function validateTablesPayload(tables: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(tables) || tables.length === 0) {
    return { valid: false, error: "'tables' must be a non-empty array." };
  }

  if (tables.length > 20) {
    return { valid: false, error: "Maximum of 20 tables allowed per request." };
  }

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    if (!t || typeof t !== "object" || Array.isArray(t)) {
      return { valid: false, error: `Table at index ${i} is not a valid object.` };
    }

    const rawTable = t as RawTablePayload;
    const rows = rawTable.rows;
    const sampleRows = rawTable.sampleRows;

    if (rows !== undefined && !Array.isArray(rows)) {
      return { valid: false, error: `Table at index ${i} has invalid 'rows' property (must be an array).` };
    }

    if (sampleRows !== undefined && !Array.isArray(sampleRows)) {
      return { valid: false, error: `Table at index ${i} has invalid 'sampleRows' property (must be an array).` };
    }

    const activeRows = Array.isArray(rows) ? rows : (Array.isArray(sampleRows) ? sampleRows : []);
    if (activeRows.length > 0 && typeof activeRows[0] !== "object") {
      return { valid: false, error: `Table at index ${i} contains non-object rows.` };
    }
  }

  return { valid: true };
}

/**
 * Pure function that truncates rows and sampleRows of each table to MAX_ROWS_PER_TABLE
 * without mutating the original input array or table objects.
 */
export function truncateTableRows(tables: RawTablePayload[]): RawTablePayload[] {
  return tables.map((table) => ({
    ...table,
    ...(Array.isArray(table.rows)
      ? { rows: table.rows.slice(0, MAX_ROWS_PER_TABLE) }
      : {}),
    ...(Array.isArray(table.sampleRows)
      ? { sampleRows: table.sampleRows.slice(0, MAX_ROWS_PER_TABLE) }
      : {}),
  }));
}

// Rate limiter for /api/analyze-table (triggers Gemini API calls)
const analyzeRateLimitMax = Number(process.env.ANALYZE_TABLE_RATE_LIMIT) || 20;
const analyzeTableLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: analyzeRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many table analysis requests from this IP. Please try again later.",
  },
});

// AI Table Analysis & Visualization Recommendation Endpoint
app.post("/api/analyze-table", analyzeTableLimiter, async (req, res) => {
  const { tables } = req.body || {};

  const validation = validateTablesPayload(tables);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const sanitizedTables = truncateTableRows(tables as RawTablePayload[]);

  try {
    // Step 1: Deterministic Statistical Profiling & Quality Analysis
    const { profiles, dataQualityMap, crossFileAnalysis } = runDeterministicAnalysis(sanitizedTables);

    // Step 2: Check for Gemini Client
    const ai = getGenAI();
    if (!ai) {
      // Deterministic fallback
      const recommendations = generateDeterministicRecommendations(profiles, crossFileAnalysis);
      const obs: string[] = [];
      profiles.forEach((p) => {
        if (p.correlations[0]) {
          obs.push(`Calculated Pearson r = ${p.correlations[0].pearsonR} between ${p.correlations[0].col1} and ${p.correlations[0].col2}.`);
        }
        if (p.temporalRelationships[0]) {
          obs.push(p.temporalRelationships[0].description);
        }
      });
      if (obs.length === 0) {
        obs.push("Data profiled deterministically. Ready for multi-dimensional visualization.");
      }

      return res.json({
        source: "deterministic",
        message: "Gemini API key not configured. Generated deterministic statistical recommendations.",
        domainSummary: `Profiled ${profiles.length} dataset${profiles.length > 1 ? "s" : ""} containing ${profiles.reduce((a, b) => a + b.rowCount, 0)} total records.`,
        keyObservations: obs.slice(0, 4),
        dataQuality: dataQualityMap,
        profiles,
        crossFileAnalysis,
        recommendations,
      });
    }

    // Step 3: Format compact prompt containing strictly profiled facts
    const compactSummary = buildAnalyticalPromptSummary(profiles, crossFileAnalysis);

    const prompt = `You are a precision data visualization consultant.
Analyze the deterministic statistical profile below and recommend 4 to 6 insightful, mathematically grounded chart configurations.

CRITICAL DIRECTIVES:
1. Ground every recommendation STRICTLY in the supplied column names, types, and statistics. Never invent columns, categories, or metrics.
2. Only mention correlation when supported by the supplied Pearson correlation coefficient (r). Never claim causation.
3. If cross-file plotting is suggested, you MUST only pair files where Cross-File Compatibility is explicitly marked compatible with a shared key. If compatibility says no reliable relationship exists, DO NOT generate cross-file recommendations.
4. Select appropriate plot types:
   - "line" or "area": strictly for chronological dates/time or continuous sequences along X.
   - "bar": for categorical dimensions or discretized dates.
   - "scatter": strictly for pairs of numeric variables.
   - "pie": only for categorical dimensions with 3 to 7 categories and positive totals.
   - "histogram": for frequency distribution of a single numeric measure.
   - "composed": for comparing dual metrics or verified cross-dataset alignments.
5. Provide a crisp title, concise 1-2 sentence description, and exact reason referencing the statistical profile.

${compactSummary}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            domainSummary: {
              type: Type.STRING,
              description: "A factual 2-sentence summary of what this data represents based on the column names and profiles.",
            },
            keyObservations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 specific findings supported by the provided statistics (e.g. ranges, correlations, distributions).",
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  plotType: {
                    type: Type.STRING,
                    description: "One of: bar, line, area, scatter, pie, radar, histogram, composed",
                  },
                  fileIndex: { type: Type.INTEGER },
                  xAxis: { type: Type.STRING },
                  yAxis: { type: Type.STRING },
                  categoryAxis: { type: Type.STRING },
                  secondaryFileIndex: { type: Type.INTEGER },
                  secondaryYAxis: { type: Type.STRING },
                  aggregation: { type: Type.STRING, description: "none, sum, mean, or count" },
                  chartTheme: {
                    type: Type.STRING,
                    description: "amber-craft, ink-minimal, sage-forest, studio-slate, or indigo-night",
                  },
                  reason: { type: Type.STRING },
                },
                required: ["title", "plotType", "fileIndex", "xAxis", "yAxis", "reason"],
              },
            },
          },
          required: ["domainSummary", "keyObservations", "recommendations"],
        },
      },
    });

    const textOutput = response.text?.trim();
    if (!textOutput) {
      throw new Error("Empty response from AI model.");
    }

    const parsed = JSON.parse(textOutput);

    // Step 4: Strict Validation and Repair Layer
    const validatedRecs = validateRecommendations(
      parsed.recommendations,
      profiles,
      crossFileAnalysis
    );

    return res.json({
      source: "gemini",
      domainSummary: parsed.domainSummary,
      keyObservations: parsed.keyObservations || [],
      dataQuality: dataQualityMap,
      profiles,
      crossFileAnalysis,
      recommendations: validatedRecs,
    });
  } catch (error: any) {
    // Sanitize error logging to prevent leaking sensitive row data in production logs
    const safeErrorMsg = error instanceof Error ? error.message : "Unknown analysis failure";
    console.error(`AI analysis pipeline error: ${safeErrorMsg}`);

    // Step 5: Graceful Fallback to Deterministic Profiler Engine
    const { profiles, dataQualityMap, crossFileAnalysis } = runDeterministicAnalysis(sanitizedTables);
    const recommendations = generateDeterministicRecommendations(profiles, crossFileAnalysis);

    const fallbackObservations: string[] = [];
    profiles.forEach((p) => {
      if (p.correlations.length > 0) {
        fallbackObservations.push(
          `Pearson r = ${p.correlations[0].pearsonR} between ${p.correlations[0].col1} and ${p.correlations[0].col2}.`
        );
      }
      if (p.temporalRelationships.length > 0) {
        fallbackObservations.push(p.temporalRelationships[0].description);
      }
    });

    return res.json({
      source: "deterministic",
      message: "Generated via deterministic statistical profiler.",
      domainSummary: "Statistical profiling and deterministic visualization recommendations based on verified data distributions.",
      keyObservations:
        fallbackObservations.length > 0
          ? fallbackObservations.slice(0, 4)
          : ["Identified quantitative indicators and categorical axes ready for charting."],
      dataQuality: dataQualityMap,
      profiles,
      crossFileAnalysis,
      recommendations,
    });
  }
});

// Vite middleware in development or static serving in production
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`vibe-plotter server running on http://localhost:${PORT}`);
  });
}

start();
