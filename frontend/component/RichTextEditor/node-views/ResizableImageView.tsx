"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";

const ResizableImageView = ({ node, updateAttributes, selected }: NodeViewProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const width = (node.attrs.width as string | null) || undefined;
  const align = (node.attrs.align as "left" | "center" | "right") || "center";
  const kind = (node.attrs.kind as string) || "image";
  const caption = (node.attrs.caption as string) || "";

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = imgRef.current?.getBoundingClientRect().width ?? 240;
      setIsResizing(true);

      const onMove = (moveEvent: PointerEvent) => {
        const next = Math.max(80, Math.min(720, Math.round(startWidth + (moveEvent.clientX - startX))));
        updateAttributes({ width: `${next}px` });
      };

      const onUp = () => {
        setIsResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`rte-image-wrap rte-image-align-${align} ${selected || isResizing ? "rte-node-selected" : ""}`}
      data-kind={kind}
      contentEditable={false}
    >
      <div className="rte-image-frame" style={{ width: width || "auto", maxWidth: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={node.attrs.src as string}
          alt={(node.attrs.alt as string) || caption || ""}
          title={(node.attrs.title as string) || ""}
          className="rte-image"
          draggable={false}
        />
        {selected ? (
          <span className="rte-image-handle" onPointerDown={startResize} title="Drag to resize" />
        ) : null}
      </div>
      {caption || selected ? (
        <figcaption className="rte-image-caption">
          {selected ? (
            <input
              type="text"
              value={caption}
              placeholder="Add a caption"
              onMouseDown={(event) => event.stopPropagation()}
              onChange={(event) => updateAttributes({ caption: event.target.value })}
            />
          ) : (
            caption
          )}
        </figcaption>
      ) : null}
      {selected ? (
        <div className="rte-image-align-bar">
          {(["left", "center", "right"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={align === value ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => updateAttributes({ align: value })}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
};

export default ResizableImageView;
