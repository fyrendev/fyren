"use client";

import { useState, useCallback } from "react";
import type { ConfirmDialogProps } from "../components/admin/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => Promise<void> | void;
}

type DialogProps = Omit<ConfirmDialogProps, "children">;

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    if (loading) return;
    setIsOpen(false);
    setOptions(null);
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
    } finally {
      setLoading(false);
      setIsOpen(false);
      setOptions(null);
    }
  }, [options]);

  const dialogProps: DialogProps = {
    isOpen,
    onClose: handleClose,
    onConfirm: handleConfirm,
    title: options?.title ?? "",
    message: options?.message ?? "",
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    variant: options?.variant,
    loading,
  };

  return { confirm, dialogProps };
}
