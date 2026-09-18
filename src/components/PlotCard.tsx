import React, { useState } from "react";
import {
  Download,
  Maximize2,
  Trash2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { ImageFormat, ParsedTable, PlotConfig } from "../types";
import { ChartCanvas } from "./ChartCanvas";
import { exportPlotToImage } from "../utils/exportImage";
import { THEME_PALETTES } from "../utils/chartDataProcessor";

interface PlotCardProps {
  plot: PlotConfig;
  tablesMap: Record<string, ParsedTable>;
  onInspect: (plot: PlotConfig) => void;
  onDelete: (id: string) => void;
}

export const PlotCard: React.FC<PlotCardProps> = ({
  plot,
  tablesMap,
  onInspect,
  onDelete,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormatName, setExportFormatName] = useState<string>("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const containerId = `chart-canvas-${plot.id}`;
  const exportCardId = `exportable-card-${plot.id}`;
  const themeMeta = THEME_PALETTES[plot.theme] || THEME_PALETTES["amber-craft"];

  const primaryTable = tablesMap[plot.primaryTableId];
  const secondaryTable = plot.secondaryTableId ? tablesMap[plot.secondaryTableId] : null;

  const handleDownload = async (format: ImageFormat) => {
    setShowExportMenu(false);
    setIsExporting(true);
    setExportFormatName(format.toUpperCase());
    try {
      await exportPlotToImage(exportCardId, plot.title, format, themeMeta.bg);
    } catch (err) {
      console.error("Failed to export chart image", err);
    } finally {
      setIsExporting(false);
      setExportFormatName("");
    }
  };

  return (
    <div
      id={exportCardId}
      style={{ borderColor: themeMeta.border, backgroundColor: themeMeta.bg }}
      className="border rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
    >
      <div>
        {/* Card Header & Controls */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                style={{ color: themeMeta.text, borderColor: themeMeta.border }}
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border font-mono bg-white/80"
              >
                {plot.plotType}
              </span>
              {plot.trendline && plot.trendline !== "none" && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold">
                  {plot.trendline === "polynomial"
                    ? `Poly Trend${plot.polynomialOrder ? ` (d=${plot.polynomialOrder})` : ""}`
                    : "Linear Trend"}
                </span>
              )}
              {plot.isCrossFile && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  Cross-File
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-stone-900 font-['Space_Grotesk'] leading-snug">
              {plot.title}
            </h3>
            {plot.description && (
              <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{plot.description}</p>
            )}
          </div>

          {/* Action buttons (marked no-export so excluded from downloaded image) */}
          <div className="no-export flex items-center gap-1 shrink-0 relative">
            {/* Inspect Button */}
            <button
              onClick={() => onInspect(plot)}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-white/80 border border-stone-200/80 transition-colors cursor-pointer shadow-2xs"
              title="Inspect plot individually with statistics"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 transition-colors cursor-pointer shadow-2xs"
                title="Download as PNG, JPEG, or JPG"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    <span className="font-mono text-[11px]">{exportFormatName}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-stone-600" />
                    <span className="font-mono text-[11px]">Save</span>
                    <ChevronDown className="w-3 h-3 text-stone-400" />
                  </>
                )}
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-stone-200 rounded-xl shadow-lg z-20 py-1 font-mono text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1 text-[10px] text-stone-400 uppercase font-bold border-b border-stone-100">
                    Export Format
                  </div>
                  <button
                    onClick={() => handleDownload("png")}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>.PNG (Crisp)</span>
                  </button>
                  <button
                    onClick={() => handleDownload("jpeg")}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>.JPEG (High Res)</span>
                  </button>
                  <button
                    onClick={() => handleDownload("jpg")}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>.JPG</span>
                  </button>
                </div>
              )}
            </div>

            {/* Delete Plot Button */}
            <button
              onClick={() => onDelete(plot.id)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Delete this plot"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="my-2 border border-stone-200/80 rounded-xl overflow-hidden p-2 bg-white/60">
          <ChartCanvas
            config={plot}
            tablesMap={tablesMap}
            containerId={containerId}
            height={280}
          />
        </div>
      </div>

      {/* Metadata footer */}
      <div className="pt-2 border-t border-stone-200/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-stone-500 gap-2">
        <div className="flex items-center gap-1.5 truncate">
          <FileSpreadsheet className="w-3 h-3 text-stone-400" />
          <span className="truncate max-w-[140px]" title={primaryTable?.fileName}>
            {primaryTable?.fileName || "Table"}
          </span>
          {secondaryTable && (
            <>
              <span className="text-stone-300">&</span>
              <span className="truncate max-w-[140px] text-amber-800" title={secondaryTable.fileName}>
                {secondaryTable.fileName}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>X: <strong>{plot.xAxisCol}</strong></span>
          <span>Y: <strong>{plot.yAxisCols.join(", ")}</strong></span>
        </div>
      </div>
    </div>
  );
};
