import React, { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, FileText, AlertCircle, Loader2, Sparkles, Layers } from "lucide-react";
import { parseUploadedFile } from "../utils/fileParsers";
import { ParsedTable } from "../types";

interface FileUploadZoneProps {
  onFilesParsed: (newTables: ParsedTable[]) => void;
  onLoadSamples: () => void;
  hasFiles: boolean;
  multipleFilesEnabled: boolean;
  onToggleMultipleFiles: (enabled: boolean) => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesParsed,
  onLoadSamples,
  hasFiles,
  multipleFilesEnabled,
  onToggleMultipleFiles,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    const allFiles = Array.from(fileList);
    if (allFiles.length === 0) return;

    // If multiple files is disabled, only accept the single first file
    const filesToProcess = multipleFilesEnabled ? allFiles : [allFiles[0]];

    setIsProcessing(true);
    setErrorMessage(null);

    const parsedTables: ParsedTable[] = [];
    const errors: string[] = [];

    for (const file of filesToProcess) {
      try {
        const table = await parseUploadedFile(file);
        parsedTables.push(table);
      } catch (err: any) {
        console.error("Error parsing file", file.name, err);
        errors.push(`${file.name}: ${err?.message || "Parsing error"}`);
      }
    }

    setIsProcessing(false);

    if (parsedTables.length > 0) {
      onFilesParsed(parsedTables);
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(" • "));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      {/* Upload Drop Zone Container */}
      <div
        id="drop-zone-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 md:p-8 text-center transition-all cursor-pointer select-none ${
          isDragging
            ? "border-amber-500 bg-amber-50/60 scale-[0.99]"
            : "border-stone-300 hover:border-amber-500 bg-[#FFFFFF] hover:bg-stone-50/70"
        } ${hasFiles ? "py-5 md:py-6" : "py-8 md:py-10"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multipleFilesEnabled}
          accept=".csv,.xlsx,.xls,.tsv,.pdf,.json,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-800 flex items-center justify-center shadow-xs border border-amber-200">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
            ) : (
              <UploadCloud className="w-6 h-6 text-amber-700" />
            )}
          </div>

          <div>
            <p className="text-base font-semibold text-stone-800">
              {isDragging
                ? "Drop file right here"
                : multipleFilesEnabled
                ? "Drag and drop multiple table files, or click to browse"
                : "Drag and drop your table file, or click to browse"}
            </p>
            <p className="text-xs text-stone-500 mt-1 max-w-lg mx-auto">
              Supports <strong className="text-stone-700 font-medium">CSV</strong>,{" "}
              <strong className="text-stone-700 font-medium">Excel (.xlsx, .xls)</strong>,{" "}
              <strong className="text-stone-700 font-medium">PDF tables</strong>,{" "}
              <strong className="text-stone-700 font-medium">TSV</strong>, and{" "}
              <strong className="text-stone-700 font-medium">JSON records</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-stone-500 font-mono">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200">
              <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> .xlsx / .xls
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200">
              <FileText className="w-3 h-3 text-blue-600" /> .csv / .tsv
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200">
              <FileText className="w-3 h-3 text-rose-600" /> .pdf (tables)
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 border border-stone-200">
              <FileText className="w-3 h-3 text-amber-600" /> .json
            </span>
          </div>

          {!hasFiles && (
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSamples();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Or load sample files to test right now</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Multiple Files Feature Button - Placed right after upload section */}
      <div className="mt-3 p-3.5 sm:p-4 rounded-xl border border-stone-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start sm:items-center space-x-3">
          <button
            type="button"
            role="switch"
            id="multi-file-toggle-btn"
            aria-checked={multipleFilesEnabled}
            onClick={() => onToggleMultipleFiles(!multipleFilesEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              multipleFilesEnabled ? "bg-amber-500" : "bg-stone-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                multipleFilesEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900">
                Multiple File Feature
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  multipleFilesEnabled
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-stone-100 text-stone-600 border border-stone-200"
                }`}
              >
                {multipleFilesEnabled ? "Enabled" : "Single File (Default)"}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {multipleFilesEnabled
                ? "Multiple files enabled: New uploads are added to your session to enable cross-file plotting."
                : "Needs to be turned on to upload more than one file. If not turned on and you upload another file, it replaces the existing one."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleMultipleFiles(!multipleFilesEnabled)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border shrink-0 ${
            multipleFilesEnabled
              ? "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100"
              : "bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100"
          }`}
        >
          {multipleFilesEnabled ? "Turn Off Multiple Files" : "Enable Multiple Files"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
