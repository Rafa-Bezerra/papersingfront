'use client'

import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    getPdfClickCoords,
    getSignaturePreviewStyle,
    handlePdfOverlayWheel,
    PdfClickCoords,
    PdfViewport,
} from '@/utils/pdfCoords'

export interface PdfSignData {
    page: number
    posX: number
    posY: number
    largura: number
    altura: number
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    /** Base64 do PDF — com ou sem prefixo data:… O prefixo é removido internamente antes de enviar ao iframe. */
    pdfBase64: string | null
    /** Habilita o overlay de clique e o botão Assinar. */
    canSign?: boolean
    /** Chamado quando o usuário confirma a posição e clica em Assinar. */
    onSign?: (data: PdfSignData) => void
    /** Chamado quando o usuário clica em Imprimir. */
    onPrint?: () => void
    /** Indica que uma operação assíncrona está em andamento (desabilita botão Assinar). */
    isLoading?: boolean
    /** Conteúdo extra inserido na barra de controles (ex.: botões customizados). */
    extraControls?: React.ReactNode
}

/**
 * Diálogo reutilizável de visualização de PDF com suporte a posicionamento de assinatura.
 *
 * O componente gerencia internamente: viewport, zoom, paginação e coordenadas de assinatura.
 * O componente pai é responsável por: abrir/fechar o diálogo, fornecer o base64 e tratar o onSign.
 */
export default function PdfViewerDialog({
    open,
    onOpenChange,
    title,
    pdfBase64,
    canSign,
    onSign,
    onPrint,
    isLoading,
    extraControls,
}: Props) {
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const [viewport, setViewport] = useState<PdfViewport | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState<number | null>(null)
    const [zoom, setZoom] = useState(1.5)
    const [coords, setCoords] = useState<PdfClickCoords | null>(null)
    const [signatureCoords, setSignatureCoords] = useState<PdfClickCoords | null>(null)
    const [previewCoords, setPreviewCoords] = useState<PdfClickCoords | null>(null)
    const [isPreviewLocked, setIsPreviewLocked] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)
    const [iframeLoaded, setIframeLoaded] = useState(false)

    const pdfStyle = viewport
        ? { width: `${viewport.width}px`, height: `${viewport.height}px` }
        : { width: '100%', height: '100%', aspectRatio: '1/1.414' }

    // Escuta mensagens do iframe (viewport e totalPages)
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return
            if (event.data?.totalPages) {
                setTotalPages(event.data.totalPages)
            }
            if (event.data?.pdfViewport) {
                const scale = event.data.pdfViewport.scale
                setViewport({
                    width: event.data.pdfViewport.width,
                    height: event.data.pdfViewport.height,
                    scale,
                })
                // Sincroniza o indicador de zoom com o scale calculado pelo iframe
                setZoom(prev => prev === 1.5 ? scale : prev)
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [])

    // Quando o pdfBase64 muda, envia ao iframe e reinicia o estado de visualização
    useEffect(() => {
        resetViewState()
    }, [pdfBase64])

    // Reinicia o estado de visualização quando o diálogo fecha
    useEffect(() => {
        if (!open) {
            resetViewState()
            setIframeLoaded(false)
            return
        }

        // Ao abrir, força recriação do iframe para evitar estado “travado”
        // quando o mesmo documento é aberto repetidas vezes.
        setIframeKey(k => k + 1)
    }, [open])

    function postPdfToIframe() {
        if (!open || !pdfBase64) return
        const clean = pdfBase64.replace(/^data:.*;base64,/, '').trim()
        iframeRef.current?.contentWindow?.postMessage({ pdfBase64: clean }, '*')
    }

    // Sempre que o diálogo abrir (mesmo PDF), reenvia o PDF quando o iframe estiver pronto.
    useEffect(() => {
        if (!open || !pdfBase64 || !iframeLoaded) return
        // Pequeno delay para garantir layout/medidas após animação do dialog
        const timer = setTimeout(() => postPdfToIframe(), 100)
        return () => clearTimeout(timer)
    }, [open, pdfBase64, iframeLoaded])

    function resetViewState() {
        setViewport(null)
        setCurrentPage(1)
        setTotalPages(null)
        setZoom(1.5)
        setCoords(null)
        setSignatureCoords(null)
        setPreviewCoords(null)
        setIsPreviewLocked(false)
    }

    function changePage(newPage: number) {
        setCurrentPage(newPage)
        iframeRef.current?.contentWindow?.postMessage({ page: newPage }, '*')
    }

    function handleZoomIn() {
        const newZoom = Math.min(5, zoom + 0.25)
        setZoom(newZoom)
        iframeRef.current?.contentWindow?.postMessage({ zoom: newZoom }, '*')
    }

    function handleZoomOut() {
        const newZoom = Math.max(0.5, zoom - 0.25)
        setZoom(newZoom)
        iframeRef.current?.contentWindow?.postMessage({ zoom: newZoom }, '*')
    }

    function handleClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!canSign) return
        const nextCoords = getPdfClickCoords(e, viewport)
        setCoords(nextCoords)
        setSignatureCoords(nextCoords)
        setPreviewCoords(null)
        setIsPreviewLocked(true)
    }

    function handleHover(e: React.MouseEvent<HTMLDivElement>) {
        if (!canSign || isPreviewLocked) return
        setPreviewCoords(getPdfClickCoords(e, viewport))
    }

    function handleSignClick() {
        if (!coords || !onSign) return
        onSign({
            page: currentPage,
            posX: coords.x,
            posY: coords.yI,
            largura: 90,
            altura: 30,
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                scrollBody={false}
                className="w-[95vw] sm:w-[60vw] h-[90dvh] max-w-none sm:max-w-none max-h-none flex flex-col overflow-hidden p-0"
            >
                <DialogHeader className="p-4 shrink-0 sticky top-0 z-10 bg-background border-b">
                    <DialogTitle className="text-lg font-semibold text-center">
                        {title}
                    </DialogTitle>
                </DialogHeader>

                {/* Área de rolagem do PDF */}
                <div
                    className="relative w-full flex-1 overflow-auto flex items-start bg-gray-50"
                    data-pdf-scroll="true"
                >
                    <div className="relative mx-auto shrink-0" style={pdfStyle}>
                        {/* iframe do PDF */}
                        <iframe
                            key={iframeKey}
                            ref={iframeRef}
                            src="/pdf-viewer.html"
                            className="relative border-none cursor-default"
                            style={pdfStyle}
                            onLoad={() => setIframeLoaded(true)}
                        />

                        {/* Overlay de interação */}
                        <div
                            className={`absolute inset-0 ${canSign ? 'cursor-crosshair' : 'cursor-default'}`}
                            onClick={handleClick}
                            onMouseMove={handleHover}
                            onMouseLeave={() => {
                                if (!isPreviewLocked) setPreviewCoords(null)
                            }}
                            onWheel={handlePdfOverlayWheel}
                        />

                        {/* Pré-visualização ao passar o mouse */}
                        {canSign && !isPreviewLocked && previewCoords && (
                            <div
                                className="absolute border-2 border-blue-600/70 bg-blue-500/10 rounded-sm pointer-events-none"
                                style={getSignaturePreviewStyle(previewCoords, viewport) ?? undefined}
                            />
                        )}

                        {/* Indicador da posição confirmada */}
                        {canSign && signatureCoords && (
                            <div
                                className="absolute border-2 border-blue-700 bg-blue-500/15 rounded-sm pointer-events-none"
                                style={getSignaturePreviewStyle(signatureCoords, viewport) ?? undefined}
                            />
                        )}
                    </div>
                </div>

                {/* Barra de controles */}
                <div className="flex justify-center items-center gap-2 sm:gap-4 p-2 sm:p-3 border-t shrink-0 bg-background flex-wrap overflow-y-auto max-h-[35%]">
                    {/* Paginação */}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => changePage(currentPage - 1)}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm">
                        Página {currentPage}{totalPages ? ` / ${totalPages}` : ''}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= (totalPages ?? 1)}
                        onClick={() => changePage(currentPage + 1)}
                    >
                        Próxima
                    </Button>

                    {/* Zoom */}
                    <div className="flex items-center gap-2 border-l pl-4 ml-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Zoom:</span>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomOut}
                            disabled={zoom <= 0.5}
                            title="Diminuir zoom"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-sm min-w-[3rem] text-center font-medium">
                            {Math.round(zoom * 100)}%
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleZoomIn}
                            disabled={zoom >= 5}
                            title="Aumentar zoom"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Controles extras do componente pai */}
                    {extraControls && (
                        <div className="flex items-center gap-2 border-l pl-4 ml-2">
                            {extraControls}
                        </div>
                    )}

                    {/* Imprimir */}
                    {onPrint && (
                        <Button variant="outline" onClick={onPrint} className="border-l ml-2 pl-4">
                            Imprimir
                        </Button>
                    )}

                    {/* Assinar */}
                    {canSign && onSign && (
                        <div className="flex items-center gap-3 border-l pl-4 ml-2">
                            {!coords ? (
                                <span className="text-xs text-muted-foreground">
                                    Clique no documento para posicionar a assinatura
                                </span>
                            ) : (
                                <span className="text-xs text-blue-600 font-medium">
                                    Posição selecionada — clique para alterar
                                </span>
                            )}
                            <Button
                                onClick={handleSignClick}
                                disabled={isLoading || !coords}
                            >
                                {isLoading ? 'Assinando...' : 'Assinar'}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
