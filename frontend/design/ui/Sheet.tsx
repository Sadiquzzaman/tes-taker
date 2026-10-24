"use client";

import Overlay, { type OverlayProps } from "./Overlay";

/** A panel that slides up from the bottom: for phone actions and pickers. Rounded top, at most 90% of the screen. */
const Sheet = (props: OverlayProps) => <Overlay placement="bottom" {...props} />;

export default Sheet;
