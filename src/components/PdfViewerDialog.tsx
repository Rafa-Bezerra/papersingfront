'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    getPdfClickCoords,
    getSignaturePreviewStyle,
    handlePdfOverlayWheel,
    pxParaNorm,
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

export type PdfMarker = {
    page: number
    posX: number
    posY: number
    largura?: number
    altura?: number
    label?: string
    /** Texto cursivo na caixa (ex.: Assinatura / Rubrica). */
    displayText?: string
    /** Quem é o dono do campo (nome ou e-mail). */
    owner?: string
    kind?: 'signature' | 'rubric' | 'text' | string
    color?: string
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    pdfBase64: string | null
    canSign?: boolean
    onSign?: (data: PdfSignData) => void
    onPrint?: () => void
    isLoading?: boolean
    extraControls?: React.ReactNode
    /** Texto do botão de confirmação (padrão: Assinar). */
    confirmLabel?: string
    /** Dica ao lado do botão. */
    placeHint?: string
    /** Após confirmar, limpa a caixa e mantém o diálogo aberto (posicionar vários campos). */
    placeMode?: boolean
    /** Tamanho inicial da caixa (px @ scale 1). */
    initialBoxW?: number
    initialBoxH?: number
    /** Marcadores já posicionados (ex.: campos anteriores). */
    markers?: PdfMarker[]
    /** Texto da caixa em edição (Assinatura / Rubrica). */
    placeFieldLabel?: string
    /** Destinatário atual do posicionamento. */
    placeOwnerLabel?: string
}

const FIELD_THEMES: Record<string, { accent: string; soft: string; ring: string }> = {
    signature: { accent: '#1d4ed8', soft: 'rgba(37, 99, 235, 0.12)', ring: 'rgba(37, 99, 235, 0.45)' },
    rubric: { accent: '#0f766e', soft: 'rgba(13, 148, 136, 0.12)', ring: 'rgba(13, 148, 136, 0.45)' },
    text: { accent: '#6d28d9', soft: 'rgba(124, 58, 237, 0.12)', ring: 'rgba(124, 58, 237, 0.45)' },
}

function themeForKind(kind?: string) {
    const k = (kind || 'signature').toLowerCase()
    if (k === 'rubric' || k === 'rúbrica') return FIELD_THEMES.rubric
    if (k === 'text' || k === 'checkbox') return FIELD_THEMES.text
    return FIELD_THEMES.signature
}

// Tamanhos padrão da caixa de assinatura (em px a scale=1)
const DEFAULT_BOX_PX_W = 90
const DEFAULT_BOX_PX_H = 30

// Handles de resize: direção → cursor + deslocamento relativo
type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const CORNER_HANDLES: ResizeDir[] = ['nw', 'ne', 'sw', 'se']
const CURSOR_MAP: Record<ResizeDir, string> = {
    n: 'ns-resize', s: 'ns-resize',
    e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize',
    nw: 'nwse-resize', se: 'nwse-resize',
}

/** Posição CSS do handle (em % relativo à caixa) */
function handleStyle(dir: ResizeDir, color: string): React.CSSProperties {
    const v = dir.includes('n') ? 0 : dir.includes('s') ? 100 : 50
    const h = dir.includes('w') ? 0 : dir.includes('e') ? 100 : 50
    return {
        position: 'absolute',
        top: `${v}%`,
        left: `${h}%`,
        width: 10,
        height: 10,
        transform: 'translate(-50%, -50%)',
        background: '#fff',
        border: `2px solid ${color}`,
        borderRadius: 999,
        cursor: CURSOR_MAP[dir],
        zIndex: 20,
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
    }
}

function fieldTitleFromMarker(m: PdfMarker): string {
    if (m.displayText) return m.displayText
    const kind = (m.kind || '').toLowerCase()
    if (kind === 'rubric' || kind === 'rúbrica') return 'Rubrica'
    if (kind === 'signature' || kind === 'assinatura') return 'Assinatura'
    if (m.label) {
        if (/rúbrica|rubric/i.test(m.label)) return 'Rubrica'
        if (/assinatura|signature/i.test(m.label)) return 'Assinatura'
        return m.label
    }
    return 'Assinatura'
}

function kindFromTitle(title: string): string {
    if (/rúbrica|rubric/i.test(title)) return 'rubric'
    if (/assinatura|signature/i.test(title)) return 'signature'
    return 'text'
}

/** Marca temporária no PDF — o signatário vê e assina neste ponto. */
function FieldPlaceholder({
    title,
    owner,
    kind,
    selected,
    style,
    onMouseDown,
    children,
}: {
    title: string
    owner?: string
    kind?: string
    selected?: boolean
    style: React.CSSProperties
    onMouseDown?: (e: React.MouseEvent) => void
    children?: React.ReactNode
}) {
    const theme = themeForKind(kind || kindFromTitle(title))
    return (
        <div
            style={{
                ...style,
                position: 'absolute',
                zIndex: selected ? 12 : 6,
                pointerEvents: onMouseDown ? 'auto' : 'none',
                cursor: onMouseDown ? 'move' : 'default',
            }}
            onMouseDown={onMouseDown}
            title={owner ? `${title} — ${owner}` : title}
        >
            <div
                className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden select-none"
                style={{
                    background: selected ? `${theme.accent}22` : `${theme.accent}18`,
                    border: `2px dashed ${theme.accent}`,
                    borderRadius: 6,
                    boxShadow: selected
                        ? `0 0 0 3px ${theme.ring}, 0 4px 14px rgba(15,23,42,0.15)`
                        : `0 1px 0 ${theme.accent}33 inset, 0 2px 10px rgba(15,23,42,0.1)`,
                    boxSizing: 'border-box',
                    padding: '3px 5px',
                    backdropFilter: 'blur(1px)',
                }}
            >
                <span
                    className="truncate max-w-full text-center font-semibold tracking-tight"
                    style={{
                        color: theme.accent,
                        fontSize: 'clamp(11px, 26%, 15px)',
                        lineHeight: 1.1,
                        textShadow: '0 0 6px rgba(255,255,255,0.85)',
                    }}
                >
                    {title}
                </span>
                {owner ? (
                    <span
                        className="mt-0.5 truncate max-w-full text-center"
                        style={{
                            color: '#0f172a',
                            fontSize: 'clamp(8px, 15%, 10px)',
                            lineHeight: 1.15,
                            background: 'rgba(255,255,255,0.72)',
                            borderRadius: 3,
                            padding: '1px 4px',
                        }}
                    >
                        {owner}
                    </span>
                ) : null}
            </div>
            {children}
        </div>
    )
}

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
    confirmLabel = 'Assinar',
    placeHint,
    placeMode = false,
    initialBoxW,
    initialBoxH,
    markers,
    placeFieldLabel,
    placeOwnerLabel,
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

    // Tamanho da caixa em px (a scale=1, sem zoom)
    const [boxPxW, setBoxPxW] = useState(initialBoxW ?? DEFAULT_BOX_PX_W)
    const [boxPxH, setBoxPxH] = useState(initialBoxH ?? DEFAULT_BOX_PX_H)

    // Drag
    const dragRef = useRef<{ startX: number; startY: number; origCoords: PdfClickCoords } | null>(null)
    // Resize
    const resizeRef = useRef<{
        dir: ResizeDir
        startX: number; startY: number
        origW: number; origH: number
        origCoords: PdfClickCoords
    } | null>(null)

    const pdfStyle = viewport
        ? { width: `${viewport.width}px`, height: `${viewport.height}px` }
        : { width: '100%', height: '100%', aspectRatio: '1/1.414' }

    // --- Helpers ---
    function overlayRef(): HTMLDivElement | null {
        return iframeRef.current?.parentElement?.querySelector('[data-overlay]') as HTMLDivElement | null
    }

    function currentBoxNorm() {
        const ow = viewport?.width || 1
        const oh = viewport?.height || 1
        const scale = viewport?.scale ?? 1
        return {
            boxW: pxParaNorm(boxPxW * scale, ow),
            boxH: pxParaNorm(boxPxH * scale, oh),
        }
    }

    // --- iframe mensagens ---
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.source !== iframeRef.current?.contentWindow) return
            if (event.data?.totalPages) setTotalPages(event.data.totalPages)
            if (event.data?.pdfViewport) {
                const scale = event.data.pdfViewport.scale
                setViewport({ width: event.data.pdfViewport.width, height: event.data.pdfViewport.height, scale })
                setZoom(prev => prev === 1.5 ? scale : prev)
            }
        }
        window.addEventListener('message', handler)
        return () => window.removeEventListener('message', handler)
    }, [])

    useEffect(() => { resetViewState() }, [pdfBase64])

    useEffect(() => {
        if (!open) { resetViewState(); setIframeLoaded(false); return }
        setIframeKey(k => k + 1)
        if (initialBoxW != null) setBoxPxW(initialBoxW)
        if (initialBoxH != null) setBoxPxH(initialBoxH)
    }, [open])

    useEffect(() => {
        if (!open) return
        if (initialBoxW != null) setBoxPxW(initialBoxW)
        if (initialBoxH != null) setBoxPxH(initialBoxH)
    }, [open, initialBoxW, initialBoxH])

    function postPdfToIframe() {
        if (!open || !pdfBase64) return
        let raw = pdfBase64.trim()
        if (raw.startsWith('"') && raw.endsWith('"')) {
            try { raw = JSON.parse(raw) as string } catch { raw = raw.slice(1, -1) }
        }
        const clean = raw.replace(/^data:.*;base64,/, '').trim()
        if (!clean.startsWith('JVBERi')) { console.error('PDF inválido'); return }
        iframeRef.current?.contentWindow?.postMessage({ pdfBase64: clean }, '*')
    }

    useEffect(() => {
        if (!open || !pdfBase64 || !iframeLoaded) return
        const timer = setTimeout(() => postPdfToIframe(), 100)
        return () => clearTimeout(timer)
    }, [open, pdfBase64, iframeLoaded])

    function resetViewState() {
        setViewport(null); setCurrentPage(1); setTotalPages(null); setZoom(1.5)
        setCoords(null); setSignatureCoords(null); setPreviewCoords(null); setIsPreviewLocked(false)
        setBoxPxW(initialBoxW ?? DEFAULT_BOX_PX_W); setBoxPxH(initialBoxH ?? DEFAULT_BOX_PX_H)
    }

    function clearPlacementBox() {
        setCoords(null)
        setSignatureCoords(null)
        setPreviewCoords(null)
        setIsPreviewLocked(false)
    }

    function changePage(p: number) {
        setCurrentPage(p)
        iframeRef.current?.contentWindow?.postMessage({ page: p }, '*')
    }

    function handleZoomIn() {
        const z = Math.min(5, zoom + 0.25); setZoom(z)
        iframeRef.current?.contentWindow?.postMessage({ zoom: z }, '*')
    }
    function handleZoomOut() {
        const z = Math.max(0.5, zoom - 0.25); setZoom(z)
        iframeRef.current?.contentWindow?.postMessage({ zoom: z }, '*')
    }

    // --- Clique: posiciona a caixa ---
    function handleClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!canSign || dragRef.current || resizeRef.current) return
        const next = getPdfClickCoords(e, viewport)
        setCoords(next); setSignatureCoords(next); setPreviewCoords(null); setIsPreviewLocked(true)
    }

    function handleHover(e: React.MouseEvent<HTMLDivElement>) {
        if (!canSign || isPreviewLocked) return
        setPreviewCoords(getPdfClickCoords(e, viewport))
    }

    // --- Drag da caixa ---
    const onBoxMouseDown = useCallback((e: React.MouseEvent) => {
        if (!signatureCoords) return
        e.stopPropagation(); e.preventDefault()
        dragRef.current = { startX: e.clientX, startY: e.clientY, origCoords: signatureCoords }

        function onMove(ev: MouseEvent) {
            if (!dragRef.current || !viewport) return
            const ov = overlayRef()
            if (!ov) return
            const rect = ov.getBoundingClientRect()
            const ow = rect.width; const oh = rect.height
            const dx = ev.clientX - dragRef.current.startX
            const dy = ev.clientY - dragRef.current.startY
            const orig = dragRef.current.origCoords
            const newX = Math.max(0, Math.min(1, orig.x + dx / ow))
            const newYI = Math.max(0, Math.min(1, orig.yI - dy / oh))
            const next: PdfClickCoords = { ...orig, x: newX, yI: newYI, y: 1 - newYI }
            setSignatureCoords(next); setCoords(next)
        }
        function onUp() {
            dragRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [signatureCoords, viewport])

    // --- Resize handles ---
    const onHandleMouseDown = useCallback((dir: ResizeDir, e: React.MouseEvent) => {
        if (!signatureCoords) return
        e.stopPropagation(); e.preventDefault()
        resizeRef.current = {
            dir,
            startX: e.clientX, startY: e.clientY,
            origW: boxPxW, origH: boxPxH,
            origCoords: signatureCoords,
        }

        function onMove(ev: MouseEvent) {
            const r = resizeRef.current; if (!r || !viewport) return
            const ov = overlayRef(); if (!ov) return
            const rect = ov.getBoundingClientRect()
            const scale = viewport.scale ?? 1
            const dx = (ev.clientX - r.startX) / scale
            const dy = (ev.clientY - r.startY) / scale

            let newW = r.origW; let newH = r.origH
            // ajuste de tamanho
            if (r.dir.includes('e')) newW = Math.max(20, r.origW + dx)
            if (r.dir.includes('w')) newW = Math.max(20, r.origW - dx)
            if (r.dir.includes('s')) newH = Math.max(8,  r.origH + dy)
            if (r.dir.includes('n')) newH = Math.max(8,  r.origH - dy)
            setBoxPxW(newW); setBoxPxH(newH)

            // se arrastou pela borda esquerda/superior, reposiciona o centro
            if (r.dir.includes('w') || r.dir.includes('n')) {
                const ow = rect.width; const oh = rect.height
                const dxNorm = r.dir.includes('w') ? -dx * scale / ow / 2 : 0
                const dyNorm = r.dir.includes('n') ? -dy * scale / oh / 2 : 0
                const orig = r.origCoords
                const newX = Math.max(0, Math.min(1, orig.x + dxNorm))
                const newYI = Math.max(0, Math.min(1, orig.yI + dyNorm))
                const next: PdfClickCoords = { ...orig, x: newX, yI: newYI, y: 1 - newYI }
                setSignatureCoords(next); setCoords(next)
            }
        }
        function onUp() {
            resizeRef.current = null
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }, [signatureCoords, boxPxW, boxPxH, viewport])

    // --- Assinar / confirmar posição ---
    function handleSignClick() {
        if (!coords || !onSign) return
        onSign({
            page: currentPage,
            posX: coords.x,
            posY: coords.yI,
            largura: boxPxW,
            altura: boxPxH,
        })
        if (placeMode) clearPlacementBox()
    }

    // Estilo da caixa com tamanho customizado
    const { boxW, boxH } = currentBoxNorm()
    const markersOnPage = (markers ?? []).filter((m) => m.page === currentPage)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                scrollBody={false}
                className="w-[95vw] sm:w-[60vw] h-[90dvh] max-w-none sm:max-w-none max-h-none flex flex-col overflow-hidden p-0"
            >
                <DialogHeader className="p-4 shrink-0 sticky top-0 z-10 bg-background border-b">
                    <DialogTitle className="text-lg font-semibold text-center">{title}</DialogTitle>
                    <DialogDescription className="sr-only">Visualização do PDF</DialogDescription>
                </DialogHeader>

                {/* Área de rolagem */}
                <div className="relative w-full flex-1 overflow-auto flex items-start bg-gray-50" data-pdf-scroll="true">
                    <div className="relative mx-auto shrink-0" style={pdfStyle}>
                        <iframe
                            key={iframeKey}
                            ref={iframeRef}
                            src="/pdf-viewer.html"
                            className="relative border-none cursor-default"
                            style={pdfStyle}
                            onLoad={() => setIframeLoaded(true)}
                        />

                        {/* Overlay de interação (clique e hover) */}
                        <div
                            data-overlay
                            className={`absolute inset-0 ${canSign ? 'cursor-crosshair' : 'cursor-default'}`}
                            onClick={handleClick}
                            onMouseMove={handleHover}
                            onMouseLeave={() => { if (!isPreviewLocked) setPreviewCoords(null) }}
                            onWheel={handlePdfOverlayWheel}
                        />

                        {/* Marcadores já posicionados */}
                        {markersOnPage.map((m, idx) => {
                            if (!viewport) return null
                            const scale = viewport.scale ?? 1
                            const refW = viewport.width || 1
                            const refH = viewport.height || 1
                            const widthPx = Math.max(24, (m.largura ?? DEFAULT_BOX_PX_W) * scale)
                            const heightPx = Math.max(16, (m.altura ?? DEFAULT_BOX_PX_H) * scale)
                            const left = m.posX * refW
                            const top = (1 - m.posY) * refH
                            return (
                                <FieldPlaceholder
                                    key={`mk-${idx}-${m.page}-${m.posX}-${m.posY}-${m.label ?? ''}`}
                                    title={fieldTitleFromMarker(m)}
                                    owner={m.owner}
                                    kind={m.kind}
                                    style={{
                                        left,
                                        top,
                                        width: widthPx,
                                        height: heightPx,
                                        transform: 'translate(-50%, -50%)',
                                    }}
                                />
                            )
                        })}

                        {/* Pré-visualização (hover) */}
                        {canSign && !isPreviewLocked && previewCoords && (() => {
                            const s = getSignaturePreviewStyle(previewCoords, viewport, DEFAULT_BOX_PX_W, DEFAULT_BOX_PX_H, boxW, boxH)
                            const theme = themeForKind(kindFromTitle(placeFieldLabel || 'Assinatura'))
                            return s ? (
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        ...s,
                                        position: 'absolute',
                                        border: `1.5px dashed ${theme.accent}`,
                                        background: theme.soft,
                                        borderRadius: 8,
                                        boxSizing: 'border-box',
                                    }}
                                />
                            ) : null
                        })()}

                        {/* Caixa em edição: arrastar + resize (cantos) */}
                        {canSign && signatureCoords && (() => {
                            const s = getSignaturePreviewStyle(signatureCoords, viewport, DEFAULT_BOX_PX_W, DEFAULT_BOX_PX_H, boxW, boxH)
                            if (!s) return null
                            const editingTitle = placeFieldLabel || 'Assinatura'
                            const editingKind = kindFromTitle(editingTitle)
                            const theme = themeForKind(editingKind)
                            return (
                                <FieldPlaceholder
                                    title={editingTitle}
                                    owner={placeOwnerLabel}
                                    kind={editingKind}
                                    selected
                                    style={{
                                        left: s.left,
                                        top: s.top,
                                        width: s.width,
                                        height: s.height,
                                        transform: s.transform,
                                    }}
                                    onMouseDown={onBoxMouseDown}
                                >
                                    {(placeMode ? CORNER_HANDLES : HANDLE_DIRS).map(dir => (
                                        <div
                                            key={dir}
                                            style={handleStyle(dir, theme.accent)}
                                            onMouseDown={e => onHandleMouseDown(dir, e)}
                                        />
                                    ))}
                                </FieldPlaceholder>
                            )
                        })()}
                    </div>
                </div>

                {placeMode && placeOwnerLabel ? (
                    <div className="shrink-0 px-3 py-2 text-center text-xs sm:text-sm border-t bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
                        Marcas temporárias para <strong>{placeOwnerLabel}</strong>
                        {' — '}ao abrir o documento, a pessoa vê esses campos e assina neles
                    </div>
                ) : !canSign && (markers?.length ?? 0) > 0 ? (
                    <div className="shrink-0 px-3 py-2 text-center text-xs sm:text-sm border-t bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
                        {(markers?.length ?? 0)} marca(s) posicionada(s) — navegue pelas páginas para ver todas
                    </div>
                ) : null}

                {/* Barra de controles */}
                <div className="flex justify-center items-center gap-2 sm:gap-4 p-2 sm:p-3 border-t shrink-0 bg-background flex-wrap overflow-y-auto max-h-[35%]">
                    {/* Paginação */}
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Anterior</Button>
                    <span className="text-sm">Página {currentPage}{totalPages ? ` / ${totalPages}` : ''}</span>
                    <Button variant="outline" size="sm" disabled={currentPage >= (totalPages ?? 1)} onClick={() => changePage(currentPage + 1)}>Próxima</Button>

                    {/* Zoom */}
                    <div className="flex items-center gap-2 border-l pl-4 ml-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Zoom:</span>
                        <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 0.5} title="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
                        <span className="text-sm min-w-[3rem] text-center font-medium">{Math.round(zoom * 100)}%</span>
                        <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 5} title="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
                    </div>

                    {/* Tamanho da caixa */}
                    {canSign && signatureCoords && (
                        <div className="flex items-center gap-2 border-l pl-4 ml-2 text-xs text-muted-foreground">
                            <span>Largura</span>
                            <input
                                type="range" min={30} max={300} step={5} value={boxPxW}
                                onChange={e => setBoxPxW(Number(e.target.value))}
                                className="w-20 accent-blue-600"
                                title={`Largura: ${Math.round(boxPxW)}px`}
                            />
                            <span>{Math.round(boxPxW)}px</span>
                            <span className="ml-2">Altura</span>
                            <input
                                type="range" min={10} max={150} step={3} value={boxPxH}
                                onChange={e => setBoxPxH(Number(e.target.value))}
                                className="w-20 accent-blue-600"
                                title={`Altura: ${Math.round(boxPxH)}px`}
                            />
                            <span>{Math.round(boxPxH)}px</span>
                        </div>
                    )}

                    {/* Controles extras */}
                    {extraControls && <div className="flex items-center gap-2 border-l pl-4 ml-2">{extraControls}</div>}

                    {/* Imprimir */}
                    {onPrint && <Button variant="outline" onClick={onPrint} className="border-l ml-2 pl-4">Imprimir</Button>}

                    {/* Assinar / confirmar posição */}
                    {canSign && onSign && (
                        <div className="flex items-center gap-3 border-l pl-4 ml-2">
                            {!coords
                                ? <span className="text-xs text-muted-foreground">{placeHint || 'Clique no documento para posicionar'}</span>
                                : <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                                    Arraste ou use os cantos para ajustar
                                  </span>
                            }
                            <Button onClick={handleSignClick} disabled={isLoading || !coords}>
                                {isLoading ? 'Salvando…' : confirmLabel}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
