import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ParsedTable, PlotConfig } from "../types";
import { prepareChartData, THEME_PALETTES } from "../utils/chartDataProcessor";

interface ChartCanvasProps {
  config: PlotConfig;
  tablesMap: Record<string, ParsedTable>;
  containerId: string;
  height?: number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  config,
  tablesMap,
  containerId,
  height = 320,
}) => {
  const { chartData, seriesKeys, xAxisKey, palette, trendData, trendEquation, trendR2 } =
    prepareChartData(config, tablesMap);
  const themeMeta = THEME_PALETTES[config.theme] || THEME_PALETTES["amber-craft"];

  if (!chartData || chartData.length === 0) {
    return (
      <div
        id={containerId}
        style={{ height, backgroundColor: themeMeta.bg }}
        className="w-full rounded-xl border border-stone-200 flex items-center justify-center text-xs text-stone-400 font-mono"
      >
        No chart data available for the selected columns.
      </div>
    );
  }

  // Custom formatted tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2.5 rounded-lg bg-stone-900/95 text-stone-100 text-xs shadow-lg border border-stone-800 font-mono max-w-xs">
          <p className="font-bold text-amber-300 pb-1 border-b border-stone-800 mb-1.5 truncate">
            {xAxisKey}: {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const isTrend =
                String(entry.dataKey || "").startsWith("_trend_") ||
                String(entry.name || "").includes("Trend");
              return (
                <div
                  key={`tooltip-${index}`}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: entry.color || entry.fill }}
                    />
                    <span
                      className={`truncate ${isTrend ? "text-amber-300 font-semibold" : "text-stone-300"}`}
                    >
                      {entry.name}:
                    </span>
                  </span>
                  <span
                    className={`font-bold shrink-0 ${isTrend ? "text-amber-300" : "text-white"}`}
                  >
                    {typeof entry.value === "number"
                      ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : entry.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderPlot = () => {
    switch (config.plotType) {
      case "line":
        return (
          <LineChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" opacity={0.6} />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
              angle={chartData.length > 8 ? -25 : 0}
              textAnchor={chartData.length > 8 ? "end" : "middle"}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />}
            {seriesKeys.map((key, idx) => (
              <React.Fragment key={key}>
                <Line
                  type={config.curveType || "monotone"}
                  dataKey={key}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2.5}
                  dot={config.showDataPoints ? { r: 3.5, strokeWidth: 1.5, fill: "#FFFFFF" } : false}
                  activeDot={{ r: 6 }}
                />
                {config.trendline && config.trendline !== "none" && (
                  <Line
                    type={config.trendline === "polynomial" ? "monotone" : "linear"}
                    dataKey={`_trend_${key}`}
                    name={`${key} (${config.trendline === "polynomial" ? `Poly Trend${config.polynomialOrder ? ` Deg ${config.polynomialOrder}` : ""}` : "Linear Trend"})`}
                    stroke={palette[idx % palette.length]}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                )}
              </React.Fragment>
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            <defs>
              {seriesKeys.map((key, idx) => (
                <linearGradient key={`grad-${key}`} id={`grad-${containerId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={palette[idx % palette.length]} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={palette[idx % palette.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" opacity={0.6} />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
              angle={chartData.length > 8 ? -25 : 0}
              textAnchor={chartData.length > 8 ? "end" : "middle"}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />}
            {seriesKeys.map((key, idx) => (
              <Area
                key={key}
                type={config.curveType || "monotone"}
                dataKey={key}
                stroke={palette[idx % palette.length]}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#grad-${containerId}-${idx})`}
              />
            ))}
          </AreaChart>
        );

      case "scatter": {
        const xIsNum = chartData.length > 0 && typeof chartData[0][xAxisKey] === "number";
        const yKey = seriesKeys[0] || xAxisKey;
        return (
          <ScatterChart margin={{ top: 15, right: 25, left: 15, bottom: 25 }}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" opacity={0.6} />}
            <XAxis
              dataKey={xAxisKey}
              name={xAxisKey}
              type={xIsNum ? "number" : "category"}
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <YAxis
              dataKey={yKey}
              name={yKey}
              type="number"
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />}
            <Scatter name={`${xAxisKey} vs ${yKey}`} data={chartData} fill={palette[0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
              ))}
            </Scatter>
            {config.trendline && config.trendline !== "none" && trendData && trendData.length > 0 && (
              <Scatter
                name={`Trend (${config.trendline === "polynomial" ? `Poly Deg ${config.polynomialOrder || 2}` : "Linear"})`}
                data={trendData}
                line={{ stroke: "#DC2626", strokeWidth: 2, strokeDasharray: "5 5" }}
                shape={() => null}
                legendType="line"
                isAnimationActive={false}
              />
            )}
          </ScatterChart>
        );
      }

      case "pie": {
        return (
          <PieChart margin={{ top: 15, right: 25, left: 25, bottom: 25 }}>
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />}
            <Pie
              data={chartData}
              dataKey="value"
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              innerRadius={height > 350 ? 55 : 35}
              outerRadius={height > 350 ? 95 : 75}
              paddingAngle={2}
              label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
              labelLine={{ stroke: "#A1A1AA" }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      }

      case "radar": {
        const metricKey = seriesKeys[0] || Object.keys(chartData[0] || {}).find((k) => k !== xAxisKey) || "value";
        return (
          <RadarChart cx="50%" cy="50%" outerRadius={height > 350 ? 100 : 75} data={chartData}>
            <PolarGrid stroke="#E5E5E0" />
            <PolarAngleAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: "#52525B", fontFamily: "monospace" }} />
            <PolarRadiusAxis angle={30} stroke="#D4D4D8" />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace" }} />}
            <Radar
              name={metricKey}
              dataKey={metricKey}
              stroke={palette[0]}
              fill={palette[0]}
              fillOpacity={0.4}
            />
          </RadarChart>
        );
      }

      case "composed":
        return (
          <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" opacity={0.6} />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
              angle={chartData.length > 8 ? -25 : 0}
              textAnchor={chartData.length > 8 ? "end" : "middle"}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />}
            {seriesKeys.map((key, idx) => {
              if (idx === 0) {
                return <Bar key={key} dataKey={key} fill={palette[0]} radius={[4, 4, 0, 0]} maxBarSize={45} />;
              }
              return (
                <Line
                  key={key}
                  type={config.curveType || "monotone"}
                  dataKey={key}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#FFFFFF" }}
                />
              );
            })}
          </ComposedChart>
        );

      case "histogram":
      case "bar":
      default:
        return (
          <BarChart data={chartData} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
            {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" opacity={0.6} />}
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
              angle={chartData.length > 8 ? -25 : 0}
              textAnchor={chartData.length > 8 ? "end" : "middle"}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#52525B", fontFamily: "monospace" }}
              tickLine={{ stroke: "#D4D4D8" }}
              axisLine={{ stroke: "#D4D4D8" }}
            />
            <Tooltip content={<CustomTooltip />} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "monospace", paddingTop: 8 }} />}
            {seriesKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={palette[idx % palette.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={55}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div
      id={containerId}
      style={{ backgroundColor: themeMeta.bg }}
      className="w-full rounded-xl transition-all relative overflow-hidden"
    >
      {config.trendline && config.trendline !== "none" && trendEquation && (
        <div className="absolute top-2 right-3 z-10 pointer-events-none bg-white/95 backdrop-blur-xs border border-stone-200/90 rounded-md px-2 py-0.5 shadow-2xs text-[10px] font-mono text-stone-700 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span>
            Trend: <strong className="text-stone-900">{trendEquation}</strong>
          </span>
          {trendR2 !== undefined && (
            <span className="text-stone-500 font-semibold">(R² = {trendR2.toFixed(2)})</span>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderPlot()}
      </ResponsiveContainer>
    </div>
  );
};
