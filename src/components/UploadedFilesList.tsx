import React from "react";
import { FileSpreadsheet, Eye, Trash2, BarChart2, Hash, Calendar, Tag, KeyRound, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { ParsedTable } from "../types";

interface UploadedFilesListProps {
  tables: ParsedTable[];
  onRemoveTable: (id: string) => void;
  onPreviewTable: (table: ParsedTable) => void;
  onSelectForPlot: (table: ParsedTable) => void;
  onRequestAIAnalysis: () => void;
  isAILoading: boolean;
}

export const UploadedFilesList: React.FC<UploadedFilesListProps> = ({
  tables,
  onRemoveTable,
  onPreviewTable,
  onSelectForPlot,
  onRequestAIAnalysis,
  isAILoading,
}) => {
  if (tables.length === 0) return null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
          <span>Active Datasets ({tables.length})</span>
          <span className="text-[11px] font-normal text-stone-500 lowercase">
            — profiled in-memory, private session
          </span>
        </h2>
        <button
          onClick={onRequestAIAnalysis}
          disabled={isAILoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>{isAILoading ? "Profiling & Generating Insights..." : "Get Visualization Recommendations"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tables.map((table) => {
          const numCount = table.columns.filter((c) => c.type === "numeric").length;
          const dateCount = table.columns.filter((c) => c.type === "date").length;
          const catCount = table.columns.filter((c) => c.type === "category").length;
          const idCount = table.columns.filter((c) => c.type === "id").length;

          const completeness = table.dataQuality?.overallCompletenessPct ?? 100;
          const outliersCount = table.dataQuality?.outliersSummary.reduce((acc, o) => acc + o.outlierCount, 0) ?? 0;

          return (
            <div
              key={table.id}
              className="bg-[#FFFFFF] border border-stone-200 rounded-xl p-4 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-stone-700">
                      <FileSpreadsheet className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="truncate">
                      <h3 className="text-sm font-semibold text-stone-900 truncate" title={table.fileName}>
                        {table.fileName}
                      </h3>
                      <p className="text-[11px] text-stone-500 font-mono">
                        {table.rowCount.toLocaleString()} rows • {table.columns.length} cols • {(table.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveTable(table.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove this file from session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Categorized column type chips */}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  {numCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                      <Hash className="w-3 h-3" /> {numCount} Numeric
                    </span>
                  )}
                  {dateCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                      <Calendar className="w-3 h-3" /> {dateCount} Date
                    </span>
                  )}
                  {catCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                      <Tag className="w-3 h-3" /> {catCount} Category
                    </span>
                  )}
                  {idCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono">
                      <KeyRound className="w-3 h-3" /> {idCount} ID
                    </span>
                  )}
                </div>

                {/* Statistical & Quality indicator */}
                <div className="mt-2.5 flex items-center gap-3 text-[11px] font-mono text-stone-600 bg-stone-50 p-2 rounded-lg border border-stone-100">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{completeness}% complete</span>
                  </span>
                  {outliersCount > 0 ? (
                    <span className="flex items-center gap-1 text-amber-700">
                      <AlertCircle className="w-3 h-3" />
                      <span>{outliersCount} outlier{outliersCount > 1 ? "s" : ""}</span>
                    </span>
                  ) : (
                    <span className="text-stone-400">no extreme outliers</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onPreviewTable(table)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-stone-600" />
                  <span>Inspect Profile</span>
                </button>

                <button
                  onClick={() => onSelectForPlot(table)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Configure Plot</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
