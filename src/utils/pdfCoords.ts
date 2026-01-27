import type { MouseEvent, WheelEvent } from "react";

export type PdfViewport = {
  width: number;
  height: number;
  scale?: number;
};

export type PdfClickCoords = {
  x: number;
  y: number;
  x2: number;
  y2: number;
  yI: number;
};

export function getSignaturePreviewStyle(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30
): { left: number; top: number; width: number; height: number; transform: string } | null {
  if (!viewport) return null;
  const scale = viewport.scale ?? 1;
  const width = Math.max(6, baseWidth * scale);
  const height = Math.max(4, baseHeight * scale);
  const maxWidth = viewport.width || width;
  const maxHeight = viewport.height || height;

  const centerX = coords.x * maxWidth;
  const centerY = maxHeight - coords.yI * maxHeight;
  const left = Math.min(Math.max(centerX, 0), maxWidth);
  const top = Math.min(Math.max(centerY, 0), maxHeight);

  return {
    left,
    top,
    width,
    height,
    transform: "translate(-50%, -50%)"
  };
}

export function getSignaturePreviewStyleFromPointer(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30
): { left: number; top: number; width: number; height: number; transform: string } | null {
  if (!viewport) return null;
  const scale = viewport.scale ?? 1;
  const width = Math.max(6, baseWidth * scale);
  const height = Math.max(4, baseHeight * scale);
  const maxWidth = viewport.width || width;
  const maxHeight = viewport.height || height;

  const left = Math.min(Math.max(coords.x2, 0), maxWidth);
  const top = Math.min(Math.max(coords.y2, 0), maxHeight);

  return {
    left,
    top,
    width,
    height,
    transform: "translate(-50%, -50%)"
  };
}

export function getPdfClickCoords(
  e: MouseEvent<HTMLDivElement>,
  viewport?: PdfViewport | null
): PdfClickCoords {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const safeCanvasWidth = rect.width > 0 ? rect.width : viewport?.width || 1;
  const safeCanvasHeight = rect.height > 0 ? rect.height : viewport?.height || 1;

  const clampedX = Math.min(Math.max(clickX, 0), safeCanvasWidth);
  const clampedY = Math.min(Math.max(clickY, 0), safeCanvasHeight);

  const x = clampedX / safeCanvasWidth;
  const y = clampedY / safeCanvasHeight;
  const yI = (safeCanvasHeight - clampedY) / safeCanvasHeight;

  return { x, y, x2: clampedX, y2: clampedY, yI };
}

export function handlePdfOverlayWheel(
  e: WheelEvent<HTMLDivElement>
) {
  const scrollContainer = e.currentTarget.closest(
    "[data-pdf-scroll=\"true\"]"
  ) as HTMLElement | null;
  if (!scrollContainer) return;
  scrollContainer.scrollTop += e.deltaY;
  scrollContainer.scrollLeft += e.deltaX;
}
