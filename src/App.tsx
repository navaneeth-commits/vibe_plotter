import React, { useState } from "react";
import { Header } from "./components/Header";
import { FileUploadZone } from "./components/FileUploadZone";
import { UploadedFilesList } from "./components/UploadedFilesList";
import { DataPreviewModal } from "./components/DataPreviewModal";
import { AIRecommendations } from "./components/AIRecommendations";
import { PlotBuilder } from "./components/PlotBuilder";
import { PlotCard } from "./components/PlotCard";
import { PlotInspectModal } from "./components/PlotInspectModal";
import {
  AIAnalysisResponse,
  AIRecommendation,
  ParsedTable,
  PlotConfig,
} from "./types";
import { getInitializedSampleTables } from "./utils/sampleData";
import { profileDataset } from "./utils/profiler/statisticalProfiler";
import {
  analyzeCorrelations,
  analyzeGroupRelationships,
  analyzeTemporalRelationships,
  analyzeCrossFileCompatibility,
} from "./utils/profiler/relationshipAnalyzer";
import { generateDeterministicRecommendations } from "./utils/profiler/recommendationEngine";
import { DatasetProfile, CrossFileCompatibility } from "./utils/profiler/types";
import { BarChart3, Compass } from "lucide-react";

export default function App() {
  const [tables, setTables] = useState<ParsedTable[]>([]);
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const [activeTableId, setActiveTableId] = useState<string>("");

  // Multiple files feature toggle
  const [multipleFilesEnabled, setMultipleFilesEnabled] = useState<boolean>(false);

  // Modals state
  const [previewTable, setPreviewTable] = useState<ParsedTable | null>(null);
  const [inspectPlot, setInspectPlot] = useState<PlotConfig | null>(null);

  // AI Analysis state (Loaded on demand, never forced automatically)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);

  // Prefill state for builder
  const [prefillConfig, setPrefillConfig] = useState<Partial<PlotConfig> | null>(null);

  // Trigger AI analysis on demand
  const triggerAIAnalysis = async (tablesToAnalyze: ParsedTable[]) => {
    if (tablesToAnalyze.length === 0) return;

    setIsAILoading(true);
    try {
      const payload = {
        tables: tablesToAnalyze.map((t) => ({
          id: t.id,
          fileName: t.fileName,
          rowCount: t.rowCount,
          rows: t.rows.slice(0, 1000),
        })),
      };

      const res = await fetch("/api/analyze-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data: AIAnalysisResponse = await res.json();
      setAiAnalysis(data);
    } catch (err) {
      console.warn("Backend AI request failed; falling back to deterministic client-side engine:", err);
      try {
        const profiles: DatasetProfile[] = [];
        const crossFileCompatibilities: CrossFileCompatibility[] = [];

        tablesToAnalyze.forEach((t) => {
          const { profile, dataQuality } = profileDataset(t.id, t.fileName, t.rows);
          const numCols = profile.columns.filter((c) => c.inferredType === "numeric").map((c) => c.name);
          const catCols = profile.columns.filter((c) => c.inferredType === "category").map((c) => c.name);
          const dateCols = profile.columns.filter((c) => c.inferredType === "date").map((c) => c.name);

          profile.correlations = analyzeCorrelations(t.rows, numCols);
          profile.groupRelationships = analyzeGroupRelationships(t.rows, catCols, numCols);
          profile.temporalRelationships = analyzeTemporalRelationships(t.rows, dateCols, numCols);
          profile.dataQuality = dataQuality;
          profiles.push(profile);
        });

        if (profiles.length >= 2) {
          for (let i = 0; i < profiles.length; i++) {
            for (let j = i + 1; j < profiles.length; j++) {
              crossFileCompatibilities.push(
                analyzeCrossFileCompatibility(
                  profiles[i],
                  profiles[j],
                  tablesToAnalyze[i].rows,
                  tablesToAnalyze[j].rows,
                  i,
                  j
                )
              );
            }
          }
        }

        const deterministicRecs = generateDeterministicRecommendations(profiles, crossFileCompatibilities);

        setAiAnalysis({
          source: "deterministic_fallback",
          recommendations: deterministicRecs,
          datasetProfiles: profiles,
          crossFileCompatibility: crossFileCompatibilities,
        });
      } catch (clientErr) {
        console.error("Client-side fallback also failed:", clientErr);
      }
    } finally {
      setIsAILoading(false);
    }
  };

  // Helper to enrich table with statistical profile & quality
  const enrichTable = (t: ParsedTable): ParsedTable => {
    if (t.profile && t.dataQuality) return t;
    try {
      const { profile, dataQuality } = profileDataset(t.id, t.fileName, t.rows);
      return { ...t, profile, dataQuality };
    } catch (e) {
      console.warn("Failed to profile table client-side:", e);
      return t;
    }
  };

  // Add parsed file(s) adhering strictly to the multipleFilesEnabled flag
  const handleFilesParsed = (newTables: ParsedTable[]) => {
    const enriched = newTables.map(enrichTable);

    if (!multipleFilesEnabled) {
      // If multiple files is disabled: replace existing file with the new one
      const singleTable = enriched[0];
      setTables([singleTable]);
      setActiveTableId(singleTable.id);
      setAiAnalysis(null);
      // Clean up plots not belonging to this table
      setPlots((prev) => prev.filter((p) => p.primaryTableId === singleTable.id));
    } else {
      // If multiple files is enabled: append to list
      setTables((prev) => {
        const combined = [...prev, ...enriched];
        if (!activeTableId && combined[0]) {
          setActiveTableId(combined[0].id);
        }
        return combined;
      });
      setAiAnalysis(null);
    }
  };

  // Load sample demo datasets
  const handleLoadSamples = () => {
    const rawSamples = getInitializedSampleTables();
    const sampleTables = rawSamples.map(enrichTable);
    setMultipleFilesEnabled(true);
    setTables(sampleTables);
    if (sampleTables.length > 0) {
      setActiveTableId(sampleTables[0].id);
      setAiAnalysis(null);
    }
  };

  // Remove a table from session
  const handleRemoveTable = (id: string) => {
    setTables((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (activeTableId === id) {
        setActiveTableId(filtered[0]?.id || "");
      }
      setAiAnalysis(null);
      return filtered;
    });

    // Remove any plots referencing this table
    setPlots((prev) => prev.filter((p) => p.primaryTableId !== id && p.secondaryTableId !== id));
  };

  // Add plot
  const handleGeneratePlot = (newPlot: PlotConfig) => {
    setPlots((prev) => [newPlot, ...prev]);
    // Scroll down to plots
    setTimeout(() => {
      document.getElementById(`plot-card-${newPlot.id}`)?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Delete individual plot
  const handleDeletePlot = (id: string) => {
    setPlots((prev) => prev.filter((p) => p.id !== id));
    if (inspectPlot?.id === id) {
      setInspectPlot(null);
    }
  };

  // Clear all plots
  const handleClearAllPlots = () => {
    if (window.confirm("Are you sure you want to clear all plotted visualizations?")) {
      setPlots([]);
    }
  };

  // Apply AI Recommendation
  const handleApplyRecommendation = (rec: AIRecommendation) => {
    const primaryT = tables[rec.fileIndex] || tables[0];
    if (!primaryT) return;

    const isCross = Boolean(
      multipleFilesEnabled &&
      rec.secondaryFileIndex !== undefined &&
      rec.secondaryFileIndex !== null &&
      rec.secondaryYAxis &&
      tables[rec.secondaryFileIndex]
    );

    const secondaryT = isCross ? tables[rec.secondaryFileIndex!] : undefined;

    const plotConfig: PlotConfig = {
      id: `ai_plot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: rec.title,
      description: rec.description,
      plotType: rec.plotType,
      primaryTableId: primaryT.id,
      xAxisCol: rec.xAxis,
      yAxisCols: [rec.yAxis],
      categoryCol: rec.categoryAxis || undefined,
      isCrossFile: isCross,
      secondaryTableId: secondaryT?.id,
      secondaryYAxisCol: rec.secondaryYAxis || undefined,
      aggregation: rec.aggregation || "none",
      theme: rec.chartTheme || "amber-craft",
      showGrid: true,
      showLegend: true,
      showDataPoints: true,
      curveType: "monotone",
      createdAt: Date.now(),
    };

    setPlots((prev) => [plotConfig, ...prev]);
    setPrefillConfig(plotConfig);
    setActiveTableId(primaryT.id);
  };

  const tablesMap = React.useMemo(() => {
    const map: Record<string, ParsedTable> = {};
    tables.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [tables]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col font-sans text-stone-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Header */}
      <Header
        filesCount={tables.length}
        plotsCount={plots.length}
        onClearAllPlots={handleClearAllPlots}
        onLoadSamples={handleLoadSamples}
      />

      {/* Main Drafting Workspace */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 flex-1">
        {/* Top Hero Drafting Banner when empty */}
        {tables.length === 0 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-[#FFFDF9] border border-[#E5E5E0] shadow-xs text-center max-w-3xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center mx-auto shadow-2xs">
              <Compass className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 font-['Space_Grotesk']">
              Draft & Plot Any Tabular Data
            </h2>
            <p className="text-sm text-stone-600 max-w-xl mx-auto leading-relaxed">
              Upload spreadsheets, CSV files, or PDF tables. Inspect column distributions, assign categorized axes, and export publication-ready plots.
            </p>
          </div>
        )}

        {/* 1. File Upload Zone with Multi-File Feature Button right after it */}
        <section aria-labelledby="upload-section">
          <FileUploadZone
            onFilesParsed={handleFilesParsed}
            onLoadSamples={handleLoadSamples}
            hasFiles={tables.length > 0}
            multipleFilesEnabled={multipleFilesEnabled}
            onToggleMultipleFiles={(enabled) => setMultipleFilesEnabled(enabled)}
          />
        </section>

        {/* 2. Uploaded Files Overview */}
        {tables.length > 0 && (
          <section aria-labelledby="active-files-section">
            <UploadedFilesList
              tables={tables}
              onRemoveTable={handleRemoveTable}
              onPreviewTable={(t) => setPreviewTable(t)}
              onSelectForPlot={(t) => {
                setActiveTableId(t.id);
                document.getElementById("builder-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              onRequestAIAnalysis={() => triggerAIAnalysis(tables)}
              isAILoading={isAILoading}
            />
          </section>
        )}

        {/* 3. AI Plot Recommendations (Centered Prompt & Disclaimers, On-Demand) */}
        {tables.length > 0 && (
          <section aria-labelledby="ai-recommendations-section">
            <AIRecommendations
              analysis={aiAnalysis}
              isLoading={isAILoading}
              onRequestAnalysis={() => triggerAIAnalysis(tables)}
              onApplyRecommendation={handleApplyRecommendation}
            />
          </section>
        )}

        {/* 4. Interactive Plot Builder */}
        {tables.length > 0 && (
          <section id="builder-section" aria-labelledby="builder-heading">
            <PlotBuilder
              tables={tables}
              activeTableId={activeTableId || tables[0]?.id || ""}
              onTableChange={(id) => setActiveTableId(id)}
              onGeneratePlot={handleGeneratePlot}
              prefillConfig={prefillConfig}
            />
          </section>
        )}

        {/* 5. Plotted Visualizations Canvas */}
        {plots.length > 0 && (
          <section id="plots-section" aria-labelledby="plots-heading" className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-700" />
                <h2 id="plots-heading" className="text-lg font-bold text-stone-900 font-['Space_Grotesk']">
                  Rendered Visualizations ({plots.length})
                </h2>
              </div>
              <span className="text-xs font-mono text-stone-500">
                Inspect plot details or download exact visual match as PNG, JPEG, JPG
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {plots.map((plot) => (
                <PlotCard
                  key={plot.id}
                  plot={plot}
                  tablesMap={tablesMap}
                  onInspect={(p) => setInspectPlot(p)}
                  onDelete={handleDeletePlot}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-[#FAF9F5] py-6 text-center text-xs text-stone-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2">
          <span>vibe-plotter • Precision tabular visualization & multi-dataset plotting</span>
          <span>Zero cloud database • 100% private in-memory session</span>
        </div>
      </footer>

      {/* 5-Row Data Preview Modal */}
      {previewTable && (
        <DataPreviewModal
          table={previewTable}
          onClose={() => setPreviewTable(null)}
          onPlotNow={(t) => {
            setActiveTableId(t.id);
            document.getElementById("builder-section")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}

      {/* Individual Plot Inspection Modal */}
      {inspectPlot && (
        <PlotInspectModal
          plot={inspectPlot}
          tablesMap={tablesMap}
          onClose={() => setInspectPlot(null)}
        />
      )}
    </div>
  );
}
