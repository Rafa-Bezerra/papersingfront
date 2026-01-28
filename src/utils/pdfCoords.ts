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

  // tamanho visual da assinatura (acompanha zoom)
  const width = Math.max(6, baseWidth * scale);
  const height = Math.max(4, baseHeight * scale);

  // posição absoluta no PDF (sem zoom)
  const left = coords.x * viewport.width;
  const top = (1 - coords.yI) * viewport.height;

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

  // container que realmente faz o scroll
  const scrollContainer = overlay.closest(
    '[data-pdf-scroll="true"]'
  ) as HTMLElement | null

  const scrollLeft = scrollContainer?.scrollLeft ?? 0
  const scrollTop = scrollContainer?.scrollTop ?? 0

  // posição do mouse dentro do overlay
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  // posição REAL no PDF (remove zoom + soma scroll)
  const pdfX = (clickX + scrollLeft) / (viewport?.scale ?? 1)
  const pdfY = (clickY + scrollTop) / (viewport?.scale ?? 1)

  const pdfWidth = viewport?.width ?? 1
  const pdfHeight = viewport?.height ?? 1

  // normalização
  const x = pdfX / pdfWidth
  const y = pdfY / pdfHeight

  // eixo Y invertido (PDF / iText)
  const yI = 1 - y

  return { x, y, yI }
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
