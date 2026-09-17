import React, { useState } from "react";
import {
  Sparkles,
  BarChart2,
  TrendingUp,
  PieChart,
  ScatterChart,
  Layers,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { AIAnalysisResponse, AIRecommendation, PlotType } from "../types";

interface AIRecommendationsProps {
  analysis: AIAnalysisResponse | null;
  isLoading: boolean;
  onRequestAnalysis: () => void;
  onApplyRecommendation: (rec: AIRecommendation) => void;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  analysis,
  isLoading,
  onRequestAnalysis,
  onApplyRecommendation,
}) => {
  const [isRevealed, setIsRevealed] = useState<boolean>(false);

  const handleGetRecommendations = () => {
    setIsRevealed(true);
    if (!analysis && !isLoading) {
      onRequestAnalysis();
    }
  };

  const getPlotIcon = (type: PlotType) => {
    switch (type) {
      case "bar":
        return <BarChart2 className="w-4 h-4 text-blue-700" />;
      case "line":
      case "area":
        return <TrendingUp className="w-4 h-4 text-emerald-700" />;
      case "scatter":
        return <ScatterChart className="w-4 h-4 text-purple-700" />;
      case "pie":
        return <PieChart className="w-4 h-4 text-amber-700" />;
      default:
        return <Layers className="w-4 h-4 text-stone-700" />;
    }
  };

  // When not yet revealed: show the centered question and disclaimer with the centered button
  if (!isRevealed) {
    return (
      <div className="w-full bg-[#FFFFFF] border border-amber-200/80 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center mx-auto shadow-2xs">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="space-y-1.5 max-w-xl mx-auto">
          <h3 className="text-base sm:text-lg font-bold text-stone-900 font-['Space_Grotesk']">
            Need recommendations by AI?
          </h3>
          <p className="text-xs text-amber-900 font-medium font-mono">
            [Note: these are recommended by AI and not some algorithm]
          </p>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            Our AI model can read your table headers, identify numeric and date trends, and suggest candidate chart configurations.
          </p>
        </div>

        {/* Centered Button */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleGetRecommendations}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-500 border border-amber-500/40 transition-all shadow-xs cursor-pointer active:scale-98"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                <span>Reading Data with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-stone-950" />
                <span>Get AI Recommendations</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Loading state when user clicked to reveal
  if (isLoading) {
    return (
      <div className="w-full bg-[#FFFFFF] border border-amber-200/80 rounded-2xl p-8 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center animate-spin text-amber-800 mx-auto">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-base font-bold text-stone-900 font-['Space_Grotesk']">
            AI Assistant is Analyzing Your Data
          </h3>
          <p className="text-xs text-amber-900 font-mono">
            [Note: these are recommended by AI and not some algorithm]
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Examining column schemas, distributions, and cross-file relationships...
          </p>
        </div>
      </div>
    );
  }

  // Revealed recommendations
  return (
    <div className="w-full bg-[#FFFFFF] border border-amber-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
      {/* Header with Title, Disclaimer & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300/80">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-stone-900 font-['Space_Grotesk']">
                AI Suggested Visualizations
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                {analysis?.source === "gemini" ? "Gemini 3.8 Flash" : "AI Suggested"}
              </span>
            </div>
            <p className="text-[11px] text-amber-800 font-mono mt-0.5">
              [Note: these are recommended by AI and not some algorithm]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onRequestAnalysis}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
            title="Re-run AI analysis"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
            <span>Re-analyze</span>
          </button>
          <button
            type="button"
            onClick={() => setIsRevealed(false)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>
      </div>

      {analysis?.domainSummary && (
        <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
          {analysis.domainSummary}
        </p>
      )}

      {/* Key observations pill highlights */}
      {analysis?.keyObservations && analysis.keyObservations.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {analysis.keyObservations.map((obs, idx) => (
            <div
              key={idx}
              className="text-[11px] font-medium text-stone-700 bg-stone-50 border border-stone-200 rounded-md px-2.5 py-1 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{obs}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations Cards */}
      {analysis?.recommendations && analysis.recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {analysis.recommendations.map((rec, rIdx) => (
            <div
              key={rIdx}
              className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 hover:bg-white hover:border-amber-400 hover:shadow-xs transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                    {getPlotIcon(rec.plotType)} {rec.plotType}
                  </span>
                  {rec.secondaryYAxis && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Cross-File
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-stone-900 group-hover:text-amber-900 transition-colors">
                  {rec.title}
                </h4>
                <p className="text-xs text-stone-600 mt-1 line-clamp-2">
                  {rec.description}
                </p>

                {/* Axis mapping breakdown */}
                <div className="mt-3 p-2 rounded-lg bg-stone-100/70 border border-stone-200/80 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-stone-700">
                    <span className="text-stone-500">X-Axis:</span>
                    <span className="font-semibold text-stone-900 truncate max-w-[150px]">{rec.xAxis}</span>
                  </div>
                  <div className="flex items-center justify-between text-stone-700">
                    <span className="text-stone-500">Y-Axis:</span>
                    <span className="font-semibold text-stone-900 truncate max-w-[150px]">{rec.yAxis}</span>
                  </div>
                  {rec.secondaryYAxis && (
                    <div className="flex items-center justify-between text-amber-800">
                      <span className="text-amber-700">File 2 Y:</span>
                      <span className="font-semibold truncate max-w-[150px]">{rec.secondaryYAxis}</span>
                    </div>
                  )}
                  {rec.aggregation && rec.aggregation !== "none" && (
                    <div className="flex items-center justify-between text-stone-700">
                      <span className="text-stone-500">Agg:</span>
                      <span className="uppercase text-amber-700 font-bold">{rec.aggregation}</span>
                    </div>
                  )}
                </div>

                {rec.reason && (
                  <p className="text-[11px] text-stone-500 italic mt-2 border-l-2 border-amber-300 pl-2">
                    "{rec.reason}"
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-200/60">
                <button
                  type="button"
                  onClick={() => onApplyRecommendation(rec)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-stone-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                >
                  <span>Plot this Insight</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-800" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-stone-500">
          No suggestions currently available for this data.
        </div>
      )}
    </div>
  );
};
