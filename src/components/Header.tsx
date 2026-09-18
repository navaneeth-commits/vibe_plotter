import React from "react";
import { Compass, Sparkles, Trash2, Database, HelpCircle } from "lucide-react";

interface HeaderProps {
  filesCount: number;
  plotsCount: number;
  onClearAllPlots: () => void;
  onLoadSamples: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  filesCount,
  plotsCount,
  onClearAllPlots,
  onLoadSamples,
}) => {
  return (
    <header id="main-header" className="border-b border-[#E5E5E0] bg-[#FFFDF9] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Metaphor */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs border border-stone-800">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-stone-900 font-['Space_Grotesk']">
                vibe-plotter
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80">
                Statistical Visualizer
              </span>
            </div>
            <p className="text-xs text-stone-500 font-sans">
              Deterministic tabular profiler • Multi-file analysis & cross-plotting
            </p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center flex-wrap gap-2.5">
          {filesCount === 0 && (
            <button
              id="load-sample-btn"
              onClick={onLoadSamples}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer"
              title="Load demo data to explore immediately"
            >
              <Database className="w-3.5 h-3.5 text-amber-700" />
              <span>Load Sample Data</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-stone-100/80 border border-stone-200 text-stone-600">
            <span>Files: <strong>{filesCount}</strong></span>
            <span className="text-stone-300">|</span>
            <span>Plots: <strong>{plotsCount}</strong></span>
          </div>

          {plotsCount > 0 && (
            <button
              id="clear-all-plots-btn"
              onClick={onClearAllPlots}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Plots</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
