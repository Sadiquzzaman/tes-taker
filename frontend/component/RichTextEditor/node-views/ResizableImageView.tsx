"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";

const ResizableImageView = ({ node, updateAttributes, selected, getPos, deleteNode }: NodeViewProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const width = (node.attrs.width as string | null) || undefined;
  const align = (node.attrs.align as "left" | "center" | "right") || "center";
  const kind = (node.attrs.kind as string) || "image";
  const caption = (node.attrs.caption as string) || "";
  const isChemistry = kind === "chemistry";
  const isGeometry = kind === "geometry";
  const isEditableFigure = isChemistry || isGeometry;

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

  const openFigureEditor = () => {
    const pos = typeof getPos === "function" ? getPos() : null;
    window.dispatchEvent(
      new CustomEvent("rte:edit-figure", {
        detail: {
          kind,
          figureJson: (node.attrs.figureJson as string | null) || null,
          mol: (node.attrs.mol as string | null) || null,
          smiles: (node.attrs.smiles as string | null) || null,
          pos: typeof pos === "number" ? pos : null,
        },
      }),
    );
  };

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
          alt={
            (node.attrs.alt as string) ||
            caption ||
            (isChemistry ? "Chemical structure" : isGeometry ? "Geometry figure" : "")
          }
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
          {isEditableFigure ? (
            <>
              <button
                type="button"
                className="is-active"
                onMouseDown={(event) => event.preventDefault()}
                onClick={openFigureEditor}
              >
                {isChemistry ? "Edit structure" : "Edit figure"}
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => deleteNode()}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
};

export default ResizableImageView;
