import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Table Analysis & Plot Recommendation Endpoint
app.post("/api/analyze-table", async (req, res) => {
  try {
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ error: "Missing or invalid tables data." });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        source: "fallback",
        message: "Gemini API key not found in environment. Generated smart algorithmic recommendations.",
        recommendations: generateFallbackRecommendations(tables),
      });
    }

    // Build prompt describing all tables
    const tableDescriptions = tables.map((t: any, idx: number) => {
      const colList = (t.columns || []).map(
        (c: any) => `- ${c.name} (${c.type}): samples [${(c.sampleValues || []).slice(0, 4).join(", ")}]`
      ).join("\n");
      const sampleRowsStr = JSON.stringify((t.sampleRows || []).slice(0, 4), null, 2);
      return `File ${idx + 1}: "${t.fileName}" (${t.rowCount} rows)\nColumns:\n${colList}\nSample rows preview:\n${sampleRowsStr}`;
    }).join("\n\n---\n\n");

    const prompt = `You are an expert data visualization consultant and scientific plotter.
Analyze the following uploaded tabular dataset(s) and recommend the most insightful, visually appealing charts to plot.

Dataset details:
${tableDescriptions}

Provide 4 to 6 specific, varied, high-quality plot recommendations. For each recommendation:
1. title: Crisp, human-crafted chart title
2. description: 1-2 sentence explanation of the pattern or metric being visualized
3. plotType: Choose from: "bar", "line", "area", "scatter", "pie", "radar", "histogram", "composed"
4. fileIndex: index of the primary table (0-based)
5. xAxis: column name to place on X-axis (or primary dimension)
6. yAxis: column name or array of column names for Y-axis (numerical metrics)
7. categoryAxis: optional column for grouping / color hue (or null)
8. secondaryFileIndex: optional index (0-based) if plotting across two files (or null)
9. secondaryYAxis: optional column from secondary file if cross-plotting (or null)
10. aggregation: "none", "sum", "mean", or "count"
11. chartTheme: "amber-craft", "ink-minimal", "sage-forest", "studio-slate", or "indigo-night"
12. reason: Why this specific visualization is valuable and what insight it reveals.

Return the result matching the structured schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            domainSummary: {
              type: Type.STRING,
              description: "A 2-sentence summary of what this dataset represents.",
            },
            keyObservations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 key findings or notable patterns in the data.",
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  plotType: { type: Type.STRING },
                  fileIndex: { type: Type.INTEGER },
                  xAxis: { type: Type.STRING },
                  yAxis: { type: Type.STRING },
                  categoryAxis: { type: Type.STRING },
                  secondaryFileIndex: { type: Type.INTEGER },
                  secondaryYAxis: { type: Type.STRING },
                  aggregation: { type: Type.STRING },
                  chartTheme: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["title", "plotType", "xAxis", "yAxis"],
              },
            },
          },
          required: ["domainSummary", "recommendations"],
        },
      },
    });

    const textOutput = response.text?.trim();
    if (!textOutput) {
      throw new Error("Empty response from AI model.");
    }

    const parsed = JSON.parse(textOutput);
    return res.json({
      source: "gemini",
      ...parsed,
    });
  } catch (error: any) {
    console.error("AI analysis error:", error);
    // Graceful fallback to algorithmic recommendations so user flow is never disrupted
    return res.json({
      source: "fallback",
      message: "AI analysis encountered an error or quota limit. Showing smart heuristic recommendations.",
      recommendations: generateFallbackRecommendations(req.body.tables || []),
      domainSummary: "Tabular dataset containing structured records ready for exploration and charting.",
      keyObservations: ["Detected numeric indicators suitable for aggregation", "Categorical dimensions ready for grouping"],
    });
  }
});

// Algorithmic smart recommendations for instant responses / fallback
function generateFallbackRecommendations(tables: any[]) {
  const recommendations: any[] = [];
  tables.forEach((table, tIdx) => {
    const cols = table.columns || [];
    const numCols = cols.filter((c: any) => c.type === "numeric");
    const catCols = cols.filter((c: any) => c.type === "category");
    const dateCols = cols.filter((c: any) => c.type === "date");

    // 1. Date + Numeric -> Line chart
    if (dateCols.length > 0 && numCols.length > 0) {
      recommendations.push({
        title: `${numCols[0].name} over Time`,
        description: `Chronological trajectory of ${numCols[0].name} tracked across ${dateCols[0].name}.`,
        plotType: "line",
        fileIndex: tIdx,
        xAxis: dateCols[0].name,
        yAxis: numCols[0].name,
        categoryAxis: catCols[0]?.name || null,
        aggregation: "none",
        chartTheme: "amber-craft",
        reason: "Time-series plots reveal historical trends, seasonality, and inflection points.",
      });
    }

    // 2. Category + Numeric -> Bar chart
    if (catCols.length > 0 && numCols.length > 0) {
      recommendations.push({
        title: `${numCols[0].name} by ${catCols[0].name}`,
        description: `Comparison of total ${numCols[0].name} distribution grouped by ${catCols[0].name}.`,
        plotType: "bar",
        fileIndex: tIdx,
        xAxis: catCols[0].name,
        yAxis: numCols[0].name,
        categoryAxis: null,
        aggregation: "sum",
        chartTheme: "studio-slate",
        reason: "Bar charts clearly communicate magnitude contrasts across discrete categories.",
      });
    }

    // 3. Category distribution -> Pie or Donut
    if (catCols.length > 0 && numCols.length > 0) {
      recommendations.push({
        title: `Proportion of ${numCols[0].name} across ${catCols[0].name}`,
        description: `Share breakdown of ${numCols[0].name} among different ${catCols[0].name} segments.`,
        plotType: "pie",
        fileIndex: tIdx,
        xAxis: catCols[0].name,
        yAxis: numCols[0].name,
        categoryAxis: null,
        aggregation: "sum",
        chartTheme: "sage-forest",
        reason: "Part-to-whole comparisons highlight dominant categories at a glance.",
      });
    }

    // 4. Two numerics -> Scatter plot
    if (numCols.length >= 2) {
      recommendations.push({
        title: `Correlation: ${numCols[0].name} vs ${numCols[1].name}`,
        description: `Bivariate dispersion analyzing the relationship between ${numCols[0].name} and ${numCols[1].name}.`,
        plotType: "scatter",
        fileIndex: tIdx,
        xAxis: numCols[0].name,
        yAxis: numCols[1].name,
        categoryAxis: catCols[0]?.name || null,
        aggregation: "none",
        chartTheme: "indigo-night",
        reason: "Scatter plots uncover clusters, outliers, and linear/non-linear dependencies.",
      });
    }

    // 5. Numeric Distribution -> Histogram
    if (numCols.length > 0) {
      recommendations.push({
        title: `Distribution of ${numCols[0].name}`,
        description: `Frequency distribution and spread of ${numCols[0].name} values.`,
        plotType: "histogram",
        fileIndex: tIdx,
        xAxis: numCols[0].name,
        yAxis: numCols[0].name,
        categoryAxis: null,
        aggregation: "none",
        chartTheme: "ink-minimal",
        reason: "Histograms show skewness, modal frequencies, and variance across values.",
      });
    }
  });

  // Cross-file recommendation if 2 or more files exist
  if (tables.length >= 2) {
    const t1 = tables[0];
    const t2 = tables[1];
    const t1Cols = (t1.columns || []).filter((c: any) => c.type === "date" || c.type === "category" || c.type === "id");
    const t1Num = (t1.columns || []).filter((c: any) => c.type === "numeric");
    const t2Num = (t2.columns || []).filter((c: any) => c.type === "numeric");

    const xCol = t1Cols[0]?.name || t1.columns?.[0]?.name;
    const yCol1 = t1Num[0]?.name || t1.columns?.[1]?.name;
    const yCol2 = t2Num[0]?.name || t2.columns?.[0]?.name;

    if (xCol && yCol1 && yCol2) {
      recommendations.push({
        title: `Cross-File Comparison: [${t1.fileName}] vs [${t2.fileName}]`,
        description: `Co-plotting ${yCol1} (${t1.fileName}) alongside ${yCol2} (${t2.fileName}).`,
        plotType: "composed",
        fileIndex: 0,
        xAxis: xCol,
        yAxis: yCol1,
        secondaryFileIndex: 1,
        secondaryYAxis: yCol2,
        aggregation: "none",
        chartTheme: "amber-craft",
        reason: "Multi-file plotting allows synthesizing disparate data sources into a unified analytical view.",
      });
    }
  }

  return recommendations;
}

// Vite middleware or production static serving
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
    console.log(`Plotter server running on http://localhost:${PORT}`);
  });
}

start();
