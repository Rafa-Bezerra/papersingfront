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
 * Retorna o estilo ABSOLUTO do preview da assinatura
 * Baseado APENAS em coordenadas normalizadas
 */
export function getSignaturePreviewStyle(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30
): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
} | null {
  if (!viewport) return null;

  const scale = viewport.scale ?? 1;
  const refWidth = coords.w || viewport.width;
  const refHeight = coords.h || viewport.height;

  // tamanho visual da assinatura (acompanha zoom)
  const width = Math.max(6, baseWidth * scale);
  const height = Math.max(4, baseHeight * scale);

  // posição absoluta no PDF (sem zoom)
  const left = coords.x * refWidth;
  const top = (1 - coords.yI) * refHeight;

  return {
    left,
    top,
    width,
    height,
    transform: "translate(-50%, -50%)",
  };
}

/**
 * Preview do mouse: segue o cursor (usa px do overlay)
 */
export function getSignaturePreviewStyleFromPointer(
  coords: PdfClickCoords,
  viewport?: PdfViewport | null,
  baseWidth = 90,
  baseHeight = 30
): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
} | null {
  const scale = viewport?.scale ?? 1;
  const width = Math.max(6, baseWidth * scale);
  const height = Math.max(4, baseHeight * scale);

  const maxWidth = coords.w || viewport?.width || width;
  const maxHeight = coords.h || viewport?.height || height;

  const left = Math.min(Math.max(coords.x2, 0), maxWidth);
  const top = Math.min(Math.max(coords.y2, 0), maxHeight);

  return {
    left,
    top,
    width,
    height,
    transform: "translate(-50%, -50%)",
  };
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
 * Permite scroll do PDF usando o mouse wheel no overlay
 */
export function handlePdfOverlayWheel(
  e: WheelEvent<HTMLDivElement>
) {
  const scrollContainer = e.currentTarget.closest(
    '[data-pdf-scroll="true"]'
  ) as HTMLElement | null;

  if (!scrollContainer) return;

  scrollContainer.scrollTop += e.deltaY;
  scrollContainer.scrollLeft += e.deltaX;
}
