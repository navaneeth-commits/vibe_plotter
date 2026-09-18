import React, { useState } from "react";
import { X, FileSpreadsheet, Hash, Calendar, Tag, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { ParsedTable, ColumnType } from "../types";

interface DataPreviewModalProps {
  table: ParsedTable | null;
  onClose: () => void;
  onPlotNow: (table: ParsedTable) => void;
}

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  table,
  onClose,
  onPlotNow,
}) => {
  const [rowCountToShow, setRowCountToShow] = useState<number>(5);

  if (!table) return null;

  const rows = table.rows.slice(0, rowCountToShow);

  const getTypeIcon = (type: ColumnType) => {
    switch (type) {
      case "numeric":
        return <Hash className="w-3 h-3 text-blue-600" />;
      case "date":
        return <Calendar className="w-3 h-3 text-amber-600" />;
      case "category":
        return <Tag className="w-3 h-3 text-emerald-600" />;
      case "id":
        return <KeyRound className="w-3 h-3 text-purple-600" />;
      default:
        return <Tag className="w-3 h-3 text-stone-600" />;
    }
  };

  const getTypeBadgeClass = (type: ColumnType) => {
    switch (type) {
      case "numeric":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "date":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "category":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "id":
        return "bg-purple-50 text-purple-800 border-purple-200";
      default:
        return "bg-stone-50 text-stone-800 border-stone-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-stone-300 rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900 truncate">
                  {table.fileName}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-700">
                  {table.fileType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-mono">
                Total Rows: {table.rowCount.toLocaleString()} • Columns: {table.columns.length}
                {table.dataQuality && (
                  <span> • Completeness: {table.dataQuality.overallCompletenessPct}%</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onPlotNow(table);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
            >
              Plot with this Data
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Column statistical profiling cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
              Deterministic Statistical Column Profiles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {table.columns.map((col) => {
                const stats = col.profile?.numericStats;
                const catStats = col.profile?.categoricalStats;
                const dateStats = col.profile?.dateStats;

                return (
                  <div
                    key={col.name}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-xs font-semibold text-stone-900 truncate" title={col.name}>
                          {col.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${getTypeBadgeClass(
                            col.type
                          )}`}
                        >
                          {getTypeIcon(col.type)} {col.type}
                        </span>
                      </div>

                      {/* Numeric summary */}
                      {col.type === "numeric" && stats && (
                        <div className="text-[11px] text-stone-600 font-mono space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-stone-400">Mean:</span>
                            <span className="font-semibold">{stats.mean.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Median:</span>
                            <span>{stats.median.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Range:</span>
                            <span>[{stats.min} .. {stats.max}]</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Std Dev:</span>
                            <span>{stats.standardDeviation}</span>
                          </div>
                          {stats.possibleOutliersCount > 0 && (
                            <div className="flex justify-between text-amber-700">
                              <span>Outliers (IQR):</span>
                              <span className="font-bold">{stats.possibleOutliersCount}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Categorical summary */}
                      {col.type === "category" && (
                        <div className="text-[11px] text-stone-600 font-mono space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-stone-400">Cardinality:</span>
                            <span className="font-semibold">{col.uniqueCount} distinct</span>
                          </div>
                          {catStats?.mode && (
                            <div className="flex justify-between">
                              <span className="text-stone-400">Top Value:</span>
                              <span className="truncate max-w-[120px]" title={catStats.mode}>
                                {catStats.mode}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date summary */}
                      {col.type === "date" && dateStats && (
                        <div className="text-[11px] text-stone-600 font-mono space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-stone-400">Span:</span>
                            <span className="font-semibold">{dateStats.spanDays ?? 0} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Interval:</span>
                            <span className="capitalize">{dateStats.approximateGranularity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Range:</span>
                            <span className="truncate max-w-[140px]">
                              {dateStats.minDate} ~ {dateStats.maxDate}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {col.nullCount !== undefined && col.nullCount > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-stone-200 text-[10px] text-amber-700 font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{col.nullCount} missing cells ({((col.nullCount / table.rowCount) * 100).toFixed(1)}%)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Data Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Data Rows (First {rows.length} rows)
              </h4>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-stone-500">Show:</span>
                {[5, 10, 20].map((count) => (
                  <button
                    key={count}
                    onClick={() => setRowCountToShow(count)}
                    className={`px-2 py-0.5 rounded font-mono text-xs cursor-pointer ${
                      rowCountToShow === count
                        ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-stone-100/80 border-b border-stone-200 text-stone-700">
                    <th className="p-2.5 px-3 border-r border-stone-200 w-12 text-stone-400 text-center font-normal">#</th>
                    {table.columns.map((col) => (
                      <th key={col.name} className="p-2.5 px-3 font-semibold whitespace-nowrap border-r border-stone-200 last:border-r-0">
                        <div className="flex items-center gap-1.5">
                          {getTypeIcon(col.type)}
                          <span className="text-stone-900 font-bold">{col.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-2 px-3 border-r border-stone-200 text-stone-400 text-center font-mono text-[11px]">
                        {rIdx + 1}
                      </td>
                      {table.columns.map((col) => {
                        const val = row[col.name];
                        const isNum = col.type === "numeric";
                        return (
                          <td
                            key={col.name}
                            className={`p-2 px-3 border-r border-stone-200 last:border-r-0 whitespace-nowrap ${
                              isNum ? "text-right font-medium text-stone-800" : "text-stone-600"
                            }`}
                          >
                            {val !== undefined && val !== null ? String(val) : <span className="text-stone-300 italic">null</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
