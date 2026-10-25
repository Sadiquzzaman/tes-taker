"use client";

import Overlay, { type OverlayProps } from "./Overlay";

export interface DrawerProps extends OverlayProps {
  /** A wider panel (up to 42rem) for long content such as an answer sheet. */
  wide?: boolean;
}

/** A panel from the right for create/edit forms, so the list stays in place behind it. Full width on phones. */
const Drawer = ({ wide = false, ...props }: DrawerProps) => (
  <Overlay placement="right" panelClassName={wide ? "max-w-2xl" : "max-w-md"} {...props} />
);

export default Drawer;
