"use client";

import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "./cn";
import IconButton from "./IconButton";
import { CloseIcon } from "./icons";

export type OverlayPlacement = "center" | "right" | "left" | "bottom";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons at the bottom (primary action last). */
  footer?: ReactNode;
  /** Hide the × button (e.g. when the user must pick an action). Esc and the backdrop still close it unless `dismissible` is false. */
  hideClose?: boolean;
  /** When false, Esc and clicking outside do nothing (a step that must be finished). */
  dismissible?: boolean;
  className?: string;
}

const PANEL: Record<OverlayPlacement, string> = {
  center:
    "w-full max-w-lg rounded-sheet data-closed:scale-95 data-closed:opacity-0 max-h-[calc(100dvh-2rem)]",
  right: "ml-auto h-full w-full max-w-md data-closed:translate-x-full",
  left: "mr-auto h-full w-72 max-w-[85vw] data-closed:-translate-x-full",
  bottom: "mt-auto max-h-[90dvh] w-full rounded-t-sheet data-closed:translate-y-full",
};

const CONTAINER: Record<OverlayPlacement, string> = {
  center: "items-center justify-center p-4",
  right: "items-stretch",
  left: "items-stretch",
  bottom: "items-end",
};

/** Shared base of Modal, Drawer, Sheet and the mobile menu: focus trap, Esc to close, focus returns afterwards. */
const Overlay = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  hideClose = false,
  dismissible = true,
  placement,
  panelClassName,
  className,
}: OverlayProps & { placement: OverlayPlacement; panelClassName?: string }) => {
  const t = useTranslations("ui");

  return (
    <Dialog open={open} onClose={dismissible ? onClose : () => {}} className={cn("relative z-50", className)}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink/40 transition-opacity duration-(--motion-sheet) ease-sheet data-closed:opacity-0"
      />
      <div className={cn("fixed inset-0 flex", CONTAINER[placement])}>
        <DialogPanel
          transition
          className={cn(
            "flex flex-col bg-surface shadow-overlay transition duration-(--motion-sheet) ease-sheet",
            PANEL[placement],
            panelClassName,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle className="text-title-sm font-semibold text-ink">{title}</DialogTitle>
              {description ? <Description className="text-body-sm text-ink-muted">{description}</Description> : null}
            </div>
            {!hideClose ? <IconButton size="sm" label={t("close")} icon={<CloseIcon />} onClick={onClose} /> : null}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? (
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default Overlay;
