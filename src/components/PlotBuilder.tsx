import React, { useState, useEffect } from "react";
import {
  BarChart2,
  TrendingUp,
  PieChart,
  ScatterChart,
  Layers,
  Palette,
  Sliders,
  Sparkles,
  Check,
  Hash,
  Calendar,
  Tag,
  KeyRound,
  FileSpreadsheet,
  PlusCircle,
  Radio,
  CheckCircle2,
} from "lucide-react";
import {
  AggregationType,
  ChartTheme,
  ColumnMeta,
  ColumnType,
  ParsedTable,
  PlotConfig,
  PlotType,
} from "../types";
import { THEME_PALETTES } from "../utils/chartDataProcessor";

interface PlotBuilderProps {
  tables: ParsedTable[];
  activeTableId: string;
  onTableChange: (id: string) => void;
  onGeneratePlot: (config: PlotConfig) => void;
  prefillConfig?: Partial<PlotConfig> | null;
}

export const PlotBuilder: React.FC<PlotBuilderProps> = ({
  tables,
  activeTableId,
  onTableChange,
  onGeneratePlot,
  prefillConfig,
}) => {
  const activeTable = tables.find((t) => t.id === activeTableId) || tables[0];

  const [plotType, setPlotType] = useState<PlotType>("bar");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Axes
  const [xAxisCol, setXAxisCol] = useState<string>("");
  const [selectedYCols, setSelectedYCols] = useState<string[]>([]);
  const [categoryCol, setCategoryCol] = useState<string>("");

  // Cross-file plotting
  const [isCrossFile, setIsCrossFile] = useState<boolean>(false);
  const [secondaryTableId, setSecondaryTableId] = useState<string>("");
  const [secondaryYCol, setSecondaryYCol] = useState<string>("");

  // Styling & Config
  const [theme, setTheme] = useState<ChartTheme>("amber-craft");
  const [aggregation, setAggregation] = useState<AggregationType>("none");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showDataPoints, setShowDataPoints] = useState<boolean>(true);
  const [curveType, setCurveType] = useState<"monotone" | "linear" | "step">("monotone");

  // Synchronize defaults when active table changes
  useEffect(() => {
    if (!activeTable) return;

    // Pick sensible default X (Date or Category or ID or first column)
    const dateCol = activeTable.columns.find((c) => c.type === "date");
    const catCol = activeTable.columns.find((c) => c.type === "category");
    const numCols = activeTable.columns.filter((c) => c.type === "numeric");

    const defaultX = dateCol?.name || catCol?.name || activeTable.columns[0]?.name || "";
    const defaultY = numCols.length > 0 ? [numCols[0].name] : (activeTable.columns[1] ? [activeTable.columns[1].name] : []);

    setXAxisCol(defaultX);
    setSelectedYCols(defaultY);

    if (numCols.length > 0) {
      setTitle(`${numCols[0].name} by ${defaultX}`);
    } else {
      setTitle(`Visualization of ${activeTable.fileName}`);
    }

    // Set secondary table default if multiple exist
    const otherTable = tables.find((t) => t.id !== activeTable.id);
    if (otherTable) {
      setSecondaryTableId(otherTable.id);
      const otherNum = otherTable.columns.find((c) => c.type === "numeric");
      setSecondaryYCol(otherNum?.name || otherTable.columns[0]?.name || "");
    }
  }, [activeTable?.id, tables.length]);

  // Disable cross-file if fewer than 2 tables
  useEffect(() => {
    if (tables.length < 2 && isCrossFile) {
      setIsCrossFile(false);
    }
  }, [tables.length, isCrossFile]);

  // Handle prefilled configuration from AI recommendations
  useEffect(() => {
    if (prefillConfig) {
      if (prefillConfig.plotType) setPlotType(prefillConfig.plotType);
      if (prefillConfig.title) setTitle(prefillConfig.title);
      if (prefillConfig.description) setDescription(prefillConfig.description);
      if (prefillConfig.xAxisCol) setXAxisCol(prefillConfig.xAxisCol);
      if (prefillConfig.yAxisCols) setSelectedYCols(prefillConfig.yAxisCols);
      if (prefillConfig.theme) setTheme(prefillConfig.theme);
      if (prefillConfig.aggregation) setAggregation(prefillConfig.aggregation);
      if (prefillConfig.isCrossFile !== undefined && tables.length >= 2) {
        setIsCrossFile(prefillConfig.isCrossFile);
        if (prefillConfig.secondaryTableId) setSecondaryTableId(prefillConfig.secondaryTableId);
        if (prefillConfig.secondaryYAxisCol) setSecondaryYCol(prefillConfig.secondaryYAxisCol);
      }
    }
  }, [prefillConfig]);

  if (!activeTable) {
    return (
      <div className="p-8 border border-stone-200 rounded-2xl bg-white text-center text-stone-500 text-sm">
        Upload a table file above or load sample data to configure a plot.
      </div>
    );
  }

  const secondaryTable = tables.find((t) => t.id === secondaryTableId);

  const toggleYColumn = (colName: string) => {
    if (selectedYCols.includes(colName)) {
      if (selectedYCols.length > 1) {
        setSelectedYCols(selectedYCols.filter((c) => c !== colName));
      }
    } else {
      setSelectedYCols([...selectedYCols, colName]);
    }
  };

  const handleGenerate = () => {
    // If Y is empty, pick default numeric or second column
    let finalY = selectedYCols;
    if (finalY.length === 0) {
      const numCol = activeTable.columns.find((c) => c.type === "numeric");
      finalY = numCol ? [numCol.name] : (activeTable.columns[1] ? [activeTable.columns[1].name] : [activeTable.columns[0]?.name || "value"]);
    }

    const finalX = xAxisCol || activeTable.columns[0]?.name || "index";

    const config: PlotConfig = {
      id: `plot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim() || `${plotType.toUpperCase()} Chart of ${finalY.join(", ")}`,
      description: description.trim(),
      plotType, // Guaranteed exact user-selected type
      primaryTableId: activeTable.id,
      xAxisCol: finalX,
      yAxisCols: finalY,
      categoryCol: categoryCol || undefined,
      isCrossFile: isCrossFile && Boolean(secondaryTableId && secondaryYCol && tables.length >= 2),
      secondaryTableId: isCrossFile ? secondaryTableId : undefined,
      secondaryYAxisCol: isCrossFile ? secondaryYCol : undefined,
      aggregation,
      theme,
      showGrid,
      showLegend,
      showDataPoints,
      curveType,
      createdAt: Date.now(),
    };

    onGeneratePlot(config);
  };

  const PLOT_TYPES: { type: PlotType; label: string; icon: any; desc: string }[] = [
    { type: "bar", label: "Bar Chart", icon: BarChart2, desc: "Comparing discrete categories" },
    { type: "line", label: "Line Chart", icon: TrendingUp, desc: "Trends over time or sequences" },
    { type: "area", label: "Area Chart", icon: Layers, desc: "Cumulative volume over intervals" },
    { type: "scatter", label: "Scatter Plot", icon: ScatterChart, desc: "Correlation between 2 metrics" },
    { type: "pie", label: "Pie / Donut", icon: PieChart, desc: "Proportions & category shares" },
    { type: "histogram", label: "Histogram", icon: BarChart2, desc: "Distribution bins of a metric" },
    { type: "radar", label: "Radar Chart", icon: Radio, desc: "Multi-dimensional performance" },
    { type: "composed", label: "Composed", icon: Layers, desc: "Bar + Line dual series" },
  ];

  // Helper to render columns ordered by type: Numeric, Date, Category, ID
  const renderOrderedColumnOptions = (columns: ColumnMeta[]) => {
    const numeric = columns.filter((c) => c.type === "numeric");
    const date = columns.filter((c) => c.type === "date");
    const category = columns.filter((c) => c.type === "category");
    const id = columns.filter((c) => c.type === "id");

    return (
      <>
        {numeric.length > 0 && (
          <optgroup label="── Numeric Columns ──">
            {numeric.map((c) => (
              <option key={c.name} value={c.name}>
                # {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {date.length > 0 && (
          <optgroup label="── Date / Time Columns ──">
            {date.map((c) => (
              <option key={c.name} value={c.name}>
                📅 {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {category.length > 0 && (
          <optgroup label="── Categorical Columns ──">
            {category.map((c) => (
              <option key={c.name} value={c.name}>
                🏷️ {c.name}
              </option>
            ))}
          </optgroup>
        )}
        {id.length > 0 && (
          <optgroup label="── Identifier / Key Columns ──">
            {id.map((c) => (
              <option key={c.name} value={c.name}>
                🔑 {c.name}
              </option>
            ))}
          </optgroup>
        )}
      </>
    );
  };

  return (
    <div className="bg-[#FFFFFF] border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-stone-900 font-['Space_Grotesk'] flex items-center gap-2">
            <span>Configure & Generate Visualization</span>
          </h2>
          <p className="text-xs text-stone-500">
            Pick your geometry, select ordered axes, customize atmosphere, and plot
          </p>
        </div>

        {/* Primary File Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-stone-600 font-mono">Source Table:</label>
          <select
            value={activeTableId}
            onChange={(e) => onTableChange(e.target.value)}
            className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 cursor-pointer focus:outline-hidden focus:border-amber-500"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fileName} ({t.rowCount} rows)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Plot Type Selector (Clear visual highlight of user selection) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
            1. Select Plot Geometry
          </label>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-bold border border-amber-300">
            Active: {plotType.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {PLOT_TYPES.map((pt) => {
            const Icon = pt.icon;
            const isSelected = plotType === pt.type;
            return (
              <button
                key={pt.type}
                type="button"
                onClick={() => {
                  setPlotType(pt.type);
                  // Update title if default
                  if (!title || title.includes("Chart") || title.includes("Visualization")) {
                    setTitle(`${pt.label} of ${activeTable.fileName}`);
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? "border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-400 shadow-xs"
                    : "border-stone-200 bg-stone-50/50 hover:bg-white hover:border-stone-300 text-stone-700"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
                <div className="flex items-center space-x-1.5 mb-1.5 pr-5">
                  <Icon className={`w-4 h-4 ${isSelected ? "text-amber-700" : "text-stone-500"}`} />
                  <span className="text-xs font-bold">{pt.label}</span>
                </div>
                <p className="text-[10px] text-stone-500 line-clamp-1 leading-tight">
                  {pt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cross-file plotting switch (if 2+ files uploaded) */}
      {tables.length >= 2 && (
        <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <input
              id="cross-file-toggle"
              type="checkbox"
              checked={isCrossFile}
              onChange={(e) => setIsCrossFile(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="cross-file-toggle" className="text-xs font-bold text-stone-900 cursor-pointer">
              Enable Cross-File Plotting (e.g. 1 column from File 1, 2nd column from File 2)
            </label>
          </div>
          <span className="text-[11px] font-mono text-amber-900">
            {isCrossFile ? "Active: Comparing columns across 2 datasets" : "Plotting within source table"}
          </span>
        </div>
      )}

      {/* 2. Axis Configuration (Ordered Columns: Numeric, Date, Category, ID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        {/* X-AXIS */}
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
              {plotType === "pie" ? "Slice Category / Dimension (X-Axis)" : plotType === "histogram" ? "Metric to Bin (X-Axis)" : "X-Axis Column (Ordered by Type)"}
            </label>
            <span className="text-[10px] font-mono text-stone-500">
              {activeTable.fileName}
            </span>
          </div>

          <select
            value={xAxisCol}
            onChange={(e) => setXAxisCol(e.target.value)}
            className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-stone-300 bg-white text-stone-900 focus:outline-hidden focus:border-amber-500 cursor-pointer font-mono"
          >
            <option value="" disabled>Select X-Axis Column...</option>
            {renderOrderedColumnOptions(activeTable.columns)}
          </select>

          <p className="text-[11px] text-stone-500">
            Columns ordered strictly: <strong>Numeric</strong>, <strong>Date</strong>, <strong>Category</strong>, <strong>ID</strong>.
          </p>
        </div>

        {/* Y-AXIS */}
        <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700">
              {plotType === "pie" ? "Slice Value Metric (Y-Axis)" : "Y-Axis Metric(s) (Primary File)"}
            </label>
            <span className="text-[10px] font-mono text-stone-500">
              Click to select metric(s)
            </span>
          </div>

          {/* Selection chips */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-stone-200 rounded-lg bg-white">
            {activeTable.columns.map((col) => {
              const isSelected = selectedYCols.includes(col.name);
              const isNum = col.type === "numeric";
              return (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => toggleYColumn(col.name)}
                  className={`text-[11px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-amber-100 text-amber-950 border-amber-400 font-bold"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  {isNum ? <Hash className="w-3 h-3 text-blue-600" /> : <Tag className="w-3 h-3 text-stone-400" />}
                  <span>{col.name}</span>
                  {isSelected && <Check className="w-3 h-3 text-amber-700 ml-0.5" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Selected metrics: <strong>{selectedYCols.length}</strong></span>
            {selectedYCols.length > 1 && (
              <span className="text-amber-800 font-mono">Multi-series enabled</span>
            )}
          </div>
        </div>
      </div>

      {/* Cross-File Secondary Column Selection */}
      {isCrossFile && tables.length >= 2 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-950">
              Secondary File & Metric (File 2)
            </label>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
              Cross-File Mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Select Second File:</label>
              <select
                value={secondaryTableId}
                onChange={(e) => setSecondaryTableId(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-lg border border-stone-300 bg-white text-stone-900 cursor-pointer focus:outline-hidden focus:border-amber-500"
              >
                {tables
                  .filter((t) => t.id !== activeTable.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fileName} ({t.rowCount} rows)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">Metric from Second File:</label>
              <select
                value={secondaryYCol}
                onChange={(e) => setSecondaryYCol(e.target.value)}
                className="w-full text-xs py-2 px-3 rounded-lg border border-stone-300 bg-white text-stone-900 cursor-pointer focus:outline-hidden focus:border-amber-500 font-mono"
              >
                {secondaryTable ? (
                  renderOrderedColumnOptions(secondaryTable.columns)
                ) : (
                  <option value="">No secondary file</option>
                )}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-amber-900/80">
            Row indices will be aligned or co-indexed, allowing side-by-side comparison of <strong>{activeTable.fileName}</strong> with <strong>{secondaryTable?.fileName}</strong>.
          </p>
        </div>
      )}

      {/* 3. Theme & Styling Options (Background & Palette) */}
      <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/40 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
          Background Atmosphere & Color Palette
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {Object.entries(THEME_PALETTES).map(([key, tMeta]) => {
            const isSelected = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key as ChartTheme)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "border-stone-900 bg-white shadow-2xs ring-2 ring-stone-900/10"
                    : "border-stone-200 bg-white/70 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0" style={{ backgroundColor: tMeta.colors[0] }} />
                  <span className="text-xs font-bold text-stone-900 truncate">{tMeta.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {tMeta.colors.slice(0, 4).map((c, i) => (
                    <div key={i} className="w-3 h-2 rounded-xs" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Aggregation & Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Aggregation Function</label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value as AggregationType)}
            className="w-full text-xs py-2 px-3 rounded-lg border border-stone-300 bg-white text-stone-900 cursor-pointer focus:outline-hidden focus:border-amber-500"
          >
            <option value="none">None (Direct Row Values)</option>
            <option value="sum">Sum (Group by X)</option>
            <option value="mean">Average / Mean</option>
            <option value="count">Count of Records</option>
            <option value="min">Minimum Value</option>
            <option value="max">Maximum Value</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Line / Area Smoothing</label>
          <select
            value={curveType}
            onChange={(e) => setCurveType(e.target.value as any)}
            className="w-full text-xs py-2 px-3 rounded-lg border border-stone-300 bg-white text-stone-900 cursor-pointer focus:outline-hidden focus:border-amber-500"
          >
            <option value="monotone">Smooth Curve (Monotone)</option>
            <option value="linear">Straight Lines (Linear)</option>
            <option value="step">Step-Wise Curve</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Visual Elements</label>
          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600"
              />
              <span>Gridlines</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600"
              />
              <span>Legend</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showDataPoints}
                onChange={(e) => setShowDataPoints(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600"
              />
              <span>Points</span>
            </label>
          </div>
        </div>
      </div>

      {/* Selected Plot Summary Verification Banner */}
      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-wrap items-center justify-between text-xs font-mono text-stone-700 gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-600" />
          <span>
            Selected Geometry: <strong className="text-stone-950 uppercase">{plotType}</strong>
          </span>
          <span>•</span>
          <span>
            X: <strong className="text-stone-950">{xAxisCol || "Auto"}</strong>
          </span>
          <span>•</span>
          <span>
            Y: <strong className="text-stone-950">{selectedYCols.join(", ") || "Auto"}</strong>
          </span>
        </div>
        <span className="text-[11px] text-stone-500">
          Theme: <strong>{THEME_PALETTES[theme]?.label || theme}</strong>
        </span>
      </div>

      {/* Title & Submit */}
      <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Chart Title (e.g. ${plotType.toUpperCase()} of ${selectedYCols[0] || "Data"})`}
          className="flex-1 text-xs py-2.5 px-3.5 rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-hidden focus:border-amber-500"
        />

        <button
          id="generate-plot-btn"
          type="button"
          onClick={handleGenerate}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-500 border border-amber-600/30 transition-all shadow-xs cursor-pointer active:scale-98"
        >
          <BarChart2 className="w-4 h-4 text-stone-950" />
          <span>Generate {plotType.toUpperCase()} Plot</span>
        </button>
      </div>
    </div>
  );
};
