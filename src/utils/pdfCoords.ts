import type { MouseEvent, WheelEvent } from "react";

/**
 * Representa o viewport REAL do PDF (sem zoom de tela).
 * width/height devem vir do PDF.js.
 */
export type PdfViewport = {
  width: number;
  height: number;
  scale?: number; // usado apenas para preview visual
};

/**
 * Coordenadas normalizadas do clique no PDF
 * - x: 0 → 1 (esquerda → direita)
 * - yI: 0 → 1 (baixo → cima)   compatível com iText
 */
export type PdfClickCoords = {
  x: number;
  y: number;
  yI: number;
  // coordenadas do mouse dentro do overlay (px)
  x2: number;
  y2: number;
  // dimensões do overlay (px)
  w: number;
  h: number;
};

/**
 * Retorna o estilo ABSOLUTO do preview da assinatura.
 * A posição é calculada a partir de coordenadas normalizadas (0–1),
 * portanto é estável independente do zoom.
 * boxW / boxH são o tamanho da caixa em unidades normalizadas (0–1).
 */
export function getSignaturePreviewStyle(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30,
  boxW?: number,   // normalizado 0–1
  boxH?: number,   // normalizado 0–1
): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
} | null {
  if (!viewport) return null;

  const refWidth = coords.w || viewport.width;
  const refHeight = coords.h || viewport.height;
  const scale = viewport.scale ?? 1;

  // tamanho visual: usa boxW/boxH normalizados se disponíveis, senão fallback em px×scale
  const width  = boxW != null ? boxW * refWidth  : Math.max(6, baseWidth  * scale);
  const height = boxH != null ? boxH * refHeight : Math.max(4, baseHeight * scale);

  // posição: centro da caixa no ponto clicado (coordenadas normalizadas → px overlay)
  const left = coords.x * refWidth;
  const top  = (1 - coords.yI) * refHeight;

  return { left, top, width, height, transform: "translate(-50%, -50%)" };
}

/**
 * Preview do mouse: segue o cursor (usa px do overlay)
 */
export function getSignaturePreviewStyleFromPointer(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30,
  boxW?: number,
  boxH?: number,
): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
} | null {
  const refWidth  = coords.w || viewport?.width  || baseWidth;
  const refHeight = coords.h || viewport?.height || baseHeight;
  const scale     = viewport?.scale ?? 1;

  const width  = boxW != null ? boxW * refWidth  : Math.max(6, baseWidth  * scale);
  const height = boxH != null ? boxH * refHeight : Math.max(4, baseHeight * scale);

  const maxWidth  = coords.w || viewport?.width  || width;
  const maxHeight = coords.h || viewport?.height || height;

  const left = Math.min(Math.max(coords.x2, 0), maxWidth);
  const top  = Math.min(Math.max(coords.y2, 0), maxHeight);

  return { left, top, width, height, transform: "translate(-50%, -50%)" };
}

/** Converte tamanho em px (no overlay atual) para normalizado 0–1. */
export function pxParaNorm(px: number, refPx: number): number {
  return refPx > 0 ? px / refPx : 0;
}

/**
 * Converte clique do mouse em coordenadas NORMALIZADAS (0–1)
 * Independente de zoom
 */
export function getPdfClickCoords(
  e: MouseEvent<HTMLDivElement>,
  viewport?: PdfViewport | null
): PdfClickCoords {
  const overlay = e.currentTarget
  const rect = overlay.getBoundingClientRect()

  // posição do mouse dentro do overlay
  const nativeEvent = e.nativeEvent as unknown as {
    offsetX?: number;
    offsetY?: number;
  };
  const clickX =
    typeof nativeEvent.offsetX === "number"
      ? nativeEvent.offsetX
      : e.clientX - rect.left;
  const clickY =
    typeof nativeEvent.offsetY === "number"
      ? nativeEvent.offsetY
      : e.clientY - rect.top;

  // usa o tamanho atual do overlay (já considera zoom)
  const pdfWidth = rect.width || viewport?.width || 1
  const pdfHeight = rect.height || viewport?.height || 1

  // normalização
  const x = clickX / pdfWidth
  const y = clickY / pdfHeight

  // eixo Y invertido (PDF / iText)
  const yI = 1 - y

  const maxWidth = rect.width || viewport?.width || 1
  const maxHeight = rect.height || viewport?.height || 1
  const clampedX = Math.min(Math.max(clickX, 0), maxWidth)
  const clampedY = Math.min(Math.max(clickY, 0), maxHeight)

  return { x, y, yI, x2: clampedX, y2: clampedY, w: maxWidth, h: maxHeight }
}


/**
 * Permite scroll do PDF usando o mouse wheel no overlay.
 * - Scroll normal: vertical
 * - Shift + Scroll: horizontal
 * - Trackpad (deltaX): horizontal
 */
export function handlePdfOverlayWheel(
  e: WheelEvent<HTMLDivElement>
) {
  const scrollContainer = e.currentTarget.closest(
    '[data-pdf-scroll="true"]'
  ) as HTMLElement | null;

  if (!scrollContainer) return;

  if (e.shiftKey) {
    scrollContainer.scrollLeft += e.deltaY;
  } else {
    scrollContainer.scrollTop += e.deltaY;
    scrollContainer.scrollLeft += e.deltaX;
  }
}
