"use client";

import { useEffect } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-navy-900 rounded-xl shadow-xl border border-navy-800 w-full max-w-sm">
          <div className="px-6 py-5">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-navy-300">{message}</p>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-navy-800">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button variant={variant} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
