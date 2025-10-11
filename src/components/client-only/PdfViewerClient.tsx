'use client';

import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configurar worker do PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  base64Pdf: string;
  handleClickPdf?: (e: React.MouseEvent<HTMLDivElement>) => void;
  coords?: { x2: number; y2: number } | null;
}

export default function PdfViewerClient({ base64Pdf, handleClickPdf, coords }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setPageWidth(containerRef.current.clientWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div ref={containerRef} className="relative flex-1 flex flex-col overflow-auto">
      <Document
        file={`data:application/pdf;base64,${base64Pdf}`}
        onLoadSuccess={onDocumentLoadSuccess}
      >
        {Array.from(new Array(numPages), (_, i) => (
          <Page key={i} pageNumber={i + 1} width={pageWidth} />
        ))}
      </Document>

      {/* Overlay para clique */}
      {handleClickPdf && (
        <div
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onClick={handleClickPdf}
        />
      )}

      {/* Indicador visual */}
      {coords && (
        <div
          className="absolute w-5 h-5 bg-blue-500/40 border-2 border-blue-700 rounded-full pointer-events-none"
          style={{ left: coords.x2 - 10, top: coords.y2 - 10 }}
        />
      )}
    </div>
  );
}
