import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      id="confirm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        id="confirm-modal-card"
        className="bg-white border border-stone-300 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 flex items-start gap-4">
          <div
            id="confirm-modal-icon-wrapper"
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              variant === "danger"
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 id="confirm-modal-title" className="text-base font-bold text-stone-900 font-['Space_Grotesk']">
              {title}
            </h3>
            <p id="confirm-modal-description" className="mt-1.5 text-sm text-stone-600 leading-relaxed">
              {message}
            </p>
          </div>

          <button
            id="confirm-modal-close-btn"
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-stone-50/80 px-5 py-3.5 border-t border-stone-200 flex items-center justify-end gap-3">
          <button
            id="confirm-modal-cancel-btn"
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            id="confirm-modal-confirm-btn"
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-xs ${
              variant === "danger"
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                : "bg-amber-700 hover:bg-amber-800 active:bg-amber-900"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
