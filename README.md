# vibe-plotter

Deterministic statistical profiling, correlation analysis, and publication-ready charting for tabular datasets.

`vibe-plotter` converts raw tabular data (CSV, Excel, TSV, PDF tables, JSON) into publication-ready interactive visualizations. Rather than relying on ungrounded AI guesses, `vibe-plotter` uses a **deterministic-first analytical pipeline**:

```text
Raw Dataset (CSV / Excel / PDF / TSV / JSON)
      ↓
In-Memory Parser (Client & Server)
      ↓
Deterministic Statistical Profiling (Min/Max/Mean/Median/StdDev/IQR Outliers)
      ↓
Data-Quality Assessment (Null counts, Cardinality, Inferred Types)
      ↓
Relationship & Compatibility Detection (Pearson r, Spearman rank, Group aggregations, Schema keys)
      ↓
AI Visualization Reasoning (Gemini 2.5 Flash strictly bounded by profile)
      ↓
Strict Validation & Fallback Repair Layer
      ↓
Interactive Visualizations (Recharts + Custom Themes + PNG/JPEG/JPG Export)
```

---

## Key Features

1. **Deterministic Statistical Profiling**
   - Calculates exact summary metrics for every column: `mean`, `median`, `standard deviation`, `min`, `max`, `quartiles (Q1, Q3)`, `IQR-based outlier detection`, and `null percentage`.
   - Distinguishes continuous numerical values from discrete categories, IDs, timestamps, and boolean flags without guessing.

2. **Rigorous Relationship & Correlation Analysis**
   - Calculates bivariate Pearson correlation coefficients ($r$) and Spearman rank correlations.
   - Non-causal analytical classification: flags strong, moderate, weak, or negligible correlations with exact sample sizes.
   - Analyzes categorical group aggregations and chronological time-series trends.

3. **Multi-Dataset Schema Compatibility**
   - Detects whether multiple uploaded files share a common dimension or key.
   - Prevents artificial or misleading cross-file chart joins when schemas do not align.

4. **Strictly Grounded AI Reasoning & Deterministic Fallback**
   - When Gemini is available, the model receives only verified statistical facts and is prohibited from fabricating columns, relationships, or causation.
   - Every recommendation is validated against real column names, statistical types, and chart semantics.
   - Works 100% offline or without API keys: generates algorithmic recommendations directly from the statistical profiler.

5. **Publication-Ready Interactive Plotting**
   - Supports Bar, Line, Area, Scatter, Pie, Radar, Histogram, and Composed charts.
   - Curated high-contrast aesthetic themes (`Amber Craft`, `Ink Minimal`, `Sage Forest`, `Studio Slate`, `Indigo Night`, `Sunset Coral`).
   - High-resolution client-side export to PNG, JPEG, and JPG preserving exact fonts, SVG vectors, and legends.

---

## Project Architecture

```text
├── server.ts                       # Express backend (port binding, static serving, Gemini API)
├── src/
│   ├── App.tsx                     # Main drafting workspace & state controller
│   ├── components/
│   │   ├── AIRecommendations.tsx   # Verified recommendation cards with source badges
│   │   ├── DataPreviewModal.tsx    # Statistical column profiler & data preview
│   │   ├── FileUploadZone.tsx      # Drag-and-drop file ingestion (CSV, XLSX, PDF, TSV, JSON)
│   │   ├── Header.tsx              # Application header & workspace controls
│   │   ├── PlotBuilder.tsx         # Interactive plot configuration desk
│   │   ├── PlotCard.tsx            # Interactive chart canvas & image export
│   │   ├── PlotInspectModal.tsx    # Deep-dive chart inspector
│   │   └── UploadedFilesList.tsx   # Active dataset cards with data-quality indicators
│   ├── utils/
│   │   ├── profiler/               # Deterministic statistical profiling suite
│   │   │   ├── types.ts            # Profiling & recommendation types
│   │   │   ├── statisticalProfiler.ts # Descriptive stats, quartiles, IQR outliers, type inference
│   │   │   ├── relationshipAnalyzer.ts # Pearson/Spearman correlations & cross-file compatibility
│   │   │   ├── recommendationEngine.ts # Grounded deterministic recommendation generation
│   │   │   ├── recommendationValidator.ts # Validation & repair of AI suggestions
│   │   │   └── index.ts            # Barrel export
│   │   ├── columnClassifier.ts     # In-memory column categorization
│   │   ├── dataParser.ts           # Multi-format tabular file parser
│   │   ├── exportImage.ts          # High-resolution raster image exporter
│   │   └── sampleData.ts           # Demo datasets for instant exploration
│   ├── types.ts                    # Global shared application types
│   └── main.tsx                    # React DOM entry point
└── tests/
    └── profiler.test.ts            # Comprehensive automated unit tests
```

---

## Local Development

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm 9+

### Install Dependencies
```bash
npm install
```

### Run Tests
```bash
npm test
```
All unit tests run using Node's native test runner (`node:test`) and verify statistical calculations, IQR outlier detection, Pearson correlation, cross-file compatibility, and recommendation validation.

### Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

---

## Production Deployment (e.g., Render / Cloud Run / VPS)

### Environment Variables
Configure the following in your deployment dashboard:
- `PORT` (Optional, default: `3000`): Automatically supplied by hosting providers like Render.
- `NODE_ENV`: Set to `production`.
- `GEMINI_API_KEY` (Optional): Required for Gemini AI reasoning. If omitted, the application automatically uses the deterministic statistical engine.

### Build & Start Commands
- **Build Command:**
  ```bash
  npm run build
  ```
  *(This compiles the React frontend via Vite into `dist/` and bundles `server.ts` into a standalone `dist/server.cjs` via esbuild).*

- **Start Command:**
  ```bash
  npm start
  ```
  *(Executes `node dist/server.cjs` on the configured `PORT`).*

---

## License
MIT License
