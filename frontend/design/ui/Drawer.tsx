"use client";

import Overlay, { type OverlayProps } from "./Overlay";

/** A panel from the right for create/edit forms, so the list stays in place behind it. Full width on phones. */
const Drawer = (props: OverlayProps) => <Overlay placement="right" {...props} />;

export default Drawer;
