import { ParsedTable } from "../types";
import { classifyColumns } from "./columnClassifier";

export const SAMPLE_DATASETS: Omit<ParsedTable, "id" | "uploadedAt">[] = [
  {
    fileName: "global_tech_hardware_sales.csv",
    fileSize: 4820,
    fileType: "csv",
    rowCount: 12,
    columns: [], // filled dynamically
    rows: [
      { Quarter: "2023-Q1", Region: "North America", Revenue_M: 420.5, Units_Sold: 124000, Gross_Margin_Pct: 38.4, Marketing_Spend_M: 45.2, CSAT_Score: 88 },
      { Quarter: "2023-Q2", Region: "North America", Revenue_M: 460.2, Units_Sold: 139000, Gross_Margin_Pct: 40.1, Marketing_Spend_M: 52.0, CSAT_Score: 90 },
      { Quarter: "2023-Q3", Region: "North America", Revenue_M: 510.8, Units_Sold: 158000, Gross_Margin_Pct: 41.5, Marketing_Spend_M: 61.4, CSAT_Score: 89 },
      { Quarter: "2023-Q4", Region: "North America", Revenue_M: 680.0, Units_Sold: 215000, Gross_Margin_Pct: 44.0, Marketing_Spend_M: 84.5, CSAT_Score: 92 },
      { Quarter: "2024-Q1", Region: "Europe", Revenue_M: 310.4, Units_Sold: 98000, Gross_Margin_Pct: 36.8, Marketing_Spend_M: 38.0, CSAT_Score: 85 },
      { Quarter: "2024-Q2", Region: "Europe", Revenue_M: 345.9, Units_Sold: 108000, Gross_Margin_Pct: 37.9, Marketing_Spend_M: 42.1, CSAT_Score: 86 },
      { Quarter: "2024-Q3", Region: "Europe", Revenue_M: 390.1, Units_Sold: 122000, Gross_Margin_Pct: 39.2, Marketing_Spend_M: 46.5, CSAT_Score: 88 },
      { Quarter: "2024-Q4", Region: "Europe", Revenue_M: 520.6, Units_Sold: 164000, Gross_Margin_Pct: 42.1, Marketing_Spend_M: 68.0, CSAT_Score: 91 },
      { Quarter: "2024-Q1", Region: "Asia Pacific", Revenue_M: 490.8, Units_Sold: 175000, Gross_Margin_Pct: 34.5, Marketing_Spend_M: 55.4, CSAT_Score: 84 },
      { Quarter: "2024-Q2", Region: "Asia Pacific", Revenue_M: 540.2, Units_Sold: 198000, Gross_Margin_Pct: 35.8, Marketing_Spend_M: 59.0, CSAT_Score: 87 },
      { Quarter: "2024-Q3", Region: "Asia Pacific", Revenue_M: 610.7, Units_Sold: 224000, Gross_Margin_Pct: 36.9, Marketing_Spend_M: 66.2, CSAT_Score: 89 },
      { Quarter: "2024-Q4", Region: "Asia Pacific", Revenue_M: 780.3, Units_Sold: 285000, Gross_Margin_Pct: 39.4, Marketing_Spend_M: 89.1, CSAT_Score: 93 },
    ],
  },
  {
    fileName: "regional_operational_costs.xlsx",
    fileSize: 3910,
    fileType: "xlsx",
    rowCount: 12,
    columns: [], // filled dynamically
    rows: [
      { Quarter: "2023-Q1", Logistics_Cost_M: 42.1, Warehouse_Rent_K: 850, Staff_Headcount: 340, Return_Rate_Pct: 3.2, Warranty_Claims_K: 120 },
      { Quarter: "2023-Q2", Logistics_Cost_M: 48.6, Warehouse_Rent_K: 890, Staff_Headcount: 365, Return_Rate_Pct: 3.0, Warranty_Claims_K: 135 },
      { Quarter: "2023-Q3", Logistics_Cost_M: 54.2, Warehouse_Rent_K: 920, Staff_Headcount: 390, Return_Rate_Pct: 2.8, Warranty_Claims_K: 142 },
      { Quarter: "2023-Q4", Logistics_Cost_M: 71.0, Warehouse_Rent_K: 1100, Staff_Headcount: 450, Return_Rate_Pct: 3.5, Warranty_Claims_K: 190 },
      { Quarter: "2024-Q1", Logistics_Cost_M: 35.4, Warehouse_Rent_K: 790, Staff_Headcount: 290, Return_Rate_Pct: 2.9, Warranty_Claims_K: 98 },
      { Quarter: "2024-Q2", Logistics_Cost_M: 39.8, Warehouse_Rent_K: 820, Staff_Headcount: 310, Return_Rate_Pct: 2.7, Warranty_Claims_K: 110 },
      { Quarter: "2024-Q3", Logistics_Cost_M: 44.5, Warehouse_Rent_K: 860, Staff_Headcount: 335, Return_Rate_Pct: 2.6, Warranty_Claims_K: 125 },
      { Quarter: "2024-Q4", Logistics_Cost_M: 58.2, Warehouse_Rent_K: 980, Staff_Headcount: 380, Return_Rate_Pct: 3.1, Warranty_Claims_K: 160 },
      { Quarter: "2024-Q1", Logistics_Cost_M: 51.3, Warehouse_Rent_K: 940, Staff_Headcount: 410, Return_Rate_Pct: 3.4, Warranty_Claims_K: 145 },
      { Quarter: "2024-Q2", Logistics_Cost_M: 56.7, Warehouse_Rent_K: 980, Staff_Headcount: 430, Return_Rate_Pct: 3.2, Warranty_Claims_K: 160 },
      { Quarter: "2024-Q3", Logistics_Cost_M: 63.9, Warehouse_Rent_K: 1040, Staff_Headcount: 465, Return_Rate_Pct: 3.0, Warranty_Claims_K: 175 },
      { Quarter: "2024-Q4", Logistics_Cost_M: 82.4, Warehouse_Rent_K: 1250, Staff_Headcount: 520, Return_Rate_Pct: 3.6, Warranty_Claims_K: 215 },
    ],
  },
];

export function getInitializedSampleTables(): ParsedTable[] {
  return SAMPLE_DATASETS.map((ds, index) => {
    const columns = classifyColumns(ds.rows);
    return {
      id: `sample_table_${index + 1}`,
      fileName: ds.fileName,
      fileSize: ds.fileSize,
      fileType: ds.fileType,
      columns,
      rows: ds.rows,
      rowCount: ds.rows.length,
      uploadedAt: Date.now() - (10 - index) * 60000,
    };
  });
}
