"use client";

import { cn } from "./cn";
import Overlay, { type OverlayProps } from "./Overlay";

export interface ModalProps extends OverlayProps {
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

/** A centred dialog for short decisions and messages. Forms belong in a Drawer (design-system §3.4). */
const Modal = ({ size = "md", className, ...rest }: ModalProps) => (
  <Overlay placement="center" panelClassName={cn(SIZES[size])} className={className} {...rest} />
);

export default Modal;
