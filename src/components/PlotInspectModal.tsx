import React, { useState } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ChevronDown,
  Hash,
  Activity,
  Table,
} from "lucide-react";
import { ImageFormat, ParsedTable, PlotConfig } from "../types";
import { ChartCanvas } from "./ChartCanvas";
import { exportPlotToImage } from "../utils/exportImage";
import { prepareChartData, THEME_PALETTES } from "../utils/chartDataProcessor";

interface PlotInspectModalProps {
  plot: PlotConfig | null;
  tablesMap: Record<string, ParsedTable>;
  onClose: () => void;
  onUpdatePlotConfig?: (updated: PlotConfig) => void;
}

export const PlotInspectModal: React.FC<PlotInspectModalProps> = ({
  plot,
  tablesMap,
  onClose,
  onUpdatePlotConfig,
}) => {
  const [activeTab, setActiveTab] = useState<"chart" | "data">("chart");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ImageFormat>("png");

  if (!plot) return null;

  const containerId = `inspect-chart-${plot.id}`;
  const themeMeta = THEME_PALETTES[plot.theme] || THEME_PALETTES["amber-craft"];
  const primaryTable = tablesMap[plot.primaryTableId];
  const secondaryTable = plot.secondaryTableId ? tablesMap[plot.secondaryTableId] : null;

  const { chartData, seriesKeys, xAxisKey, trendEquation, trendR2 } = prepareChartData(plot, tablesMap);

  // Calculate statistics for numeric series
  const stats = seriesKeys.map((key) => {
    const values = chartData
      .map((d) => Number(d[key]))
      .filter((v) => !isNaN(v) && v !== null);

    if (values.length === 0) return null;

    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      key,
      count: values.length,
      sum: Math.round(sum * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      min,
      max,
    };
  }).filter(Boolean);

  const handleDownload = async (format: ImageFormat = selectedFormat) => {
    setIsExporting(true);
    try {
      await exportPlotToImage(
        "inspect-full-canvas-wrapper",
        `${plot.title}_inspect`,
        format,
        themeMeta.bg
      );
    } catch (err) {
      console.error("Export error", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-stone-300 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 font-mono">
                {plot.plotType}
              </span>
              {plot.isCrossFile && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-semibold">
                  Cross-File
                </span>
              )}
              <h3 className="text-lg font-bold text-stone-900 font-['Space_Grotesk']">
                {plot.title}
              </h3>
            </div>
            <p className="text-xs text-stone-500 font-mono mt-0.5">
              Source: {primaryTable?.fileName} {secondaryTable ? `& ${secondaryTable.fileName}` : ""} • X: {xAxisKey} • Y: {seriesKeys.join(", ")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Download selector */}
            <div className="flex items-center bg-white border border-stone-300 rounded-xl p-0.5 shadow-2xs">
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ImageFormat)}
                className="text-xs font-mono font-semibold py-1 px-2 border-r border-stone-200 bg-transparent text-stone-800 cursor-pointer focus:outline-hidden"
              >
                <option value="png">PNG (Lossless)</option>
                <option value="jpeg">JPEG (High Res)</option>
                <option value="jpg">JPG</option>
              </select>
              <button
                onClick={() => handleDownload()}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-stone-900 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-800" />
                <span>Download</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="px-6 border-b border-stone-200 bg-white flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("chart")}
            className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "chart"
                ? "border-amber-500 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Activity className="w-4 h-4 text-amber-700" />
            <span>High-Res Visualization</span>
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`py-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === "data"
                ? "border-amber-500 text-stone-900"
                : "border-transparent text-stone-400 hover:text-stone-700"
            }`}
          >
            <Table className="w-4 h-4 text-stone-500" />
            <span>Plotted Data Points ({chartData.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === "chart" ? (
            <>
              {/* Full Canvas */}
              <div id="inspect-full-canvas-wrapper" className="border border-stone-200 rounded-2xl p-3 sm:p-4 bg-white shadow-xs">
                <ChartCanvas
                  config={plot}
                  tablesMap={tablesMap}
                  containerId={containerId}
                  height={440}
                />
              </div>

              {/* Statistics Breakdown */}
              {stats.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                    Plotted Metric Statistical Overview
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {stats.map((s) => (
                      <div
                        key={s!.key}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 font-mono text-xs space-y-1"
                      >
                        <div className="font-bold text-stone-900 truncate mb-1 border-b border-stone-200 pb-1">
                          {s!.key}
                        </div>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Count:</span>
                          <strong>{s!.count}</strong>
                        </div>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Mean (Avg):</span>
                          <strong>{s!.mean.toLocaleString()}</strong>
                        </div>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Min:</span>
                          <strong>{s!.min.toLocaleString()}</strong>
                        </div>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Max:</span>
                          <strong>{s!.max.toLocaleString()}</strong>
                        </div>
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Sum:</span>
                          <strong>{s!.sum.toLocaleString()}</strong>
                        </div>
                      </div>
                    ))}

                    {plot.trendline && plot.trendline !== "none" && trendEquation && (
                      <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 font-mono text-xs space-y-1">
                        <div className="font-bold text-red-900 truncate mb-1 border-b border-red-200 pb-1 flex items-center justify-between">
                          <span>Trendline Regression</span>
                          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-red-100 text-red-800">
                            {plot.trendline}
                          </span>
                        </div>
                        <div className="text-stone-700">
                          <span className="text-stone-500 text-[11px] block">Equation:</span>
                          <strong className="text-stone-900 break-all">{trendEquation}</strong>
                        </div>
                        {trendR2 !== undefined && (
                          <div className="flex items-center justify-between text-stone-600 pt-1">
                            <span>Goodness of Fit (R²):</span>
                            <strong className="text-red-700">{trendR2.toFixed(4)}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Data Points Table */
            <div className="border border-stone-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-stone-100/80 border-b border-stone-200 text-stone-700">
                    <th className="p-2.5 px-3 border-r border-stone-200 w-12 text-stone-400 text-center font-normal">#</th>
                    <th className="p-2.5 px-3 border-r border-stone-200 font-bold text-stone-900">
                      {xAxisKey} (X)
                    </th>
                    {seriesKeys.map((key) => (
                      <th key={key} className="p-2.5 px-3 border-r border-stone-200 last:border-r-0 font-bold text-stone-900 text-right">
                        {key} (Y)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {chartData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-2 px-3 border-r border-stone-200 text-stone-400 text-center font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2 px-3 border-r border-stone-200 font-medium text-stone-900 whitespace-nowrap">
                        {String(row[xAxisKey])}
                      </td>
                      {seriesKeys.map((key) => {
                        const val = row[key];
                        return (
                          <td
                            key={key}
                            className="p-2 px-3 border-r border-stone-200 last:border-r-0 text-right font-medium text-stone-800 whitespace-nowrap"
                          >
                            {typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs font-mono text-stone-500">
            Theme: <strong>{themeMeta.label}</strong> • Aggregation: <strong>{plot.aggregation.toUpperCase()}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
