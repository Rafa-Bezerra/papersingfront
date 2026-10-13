'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { Bell, Download, ExternalLink, Eye, FileSignature, History, Loader2, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PdfViewerDialog from '@/components/PdfViewerDialog'
import { nomeExibicao } from '@/components/MinhasSolicitacoesPanel'
import WaySignDetalhesDialog from '@/components/WaySignDetalhesDialog'
import { imprimirPdfBase64 } from '@/utils/functions'
import { base64ParaImpressao } from '@/utils/documentoAnexo'
import { baixarBase64, mensagemDownloadSucesso } from '@/utils/downloadFile'
import {
  assinarSolicitacaoPlugSign,
  baixarDocumentoAssinadoSolicitacao,
  enviarLembreteSolicitacao,
  ItemWaySign,
  obterMinhaAssinaturaPlugSign,
} from '@/services/docusignService'

/**
 * Ações de uma linha PlugSign da lista única (mesmas do MinhasSolicitacoesPanel)
 * + assinatura do usuário quando ele é signatário pendente (minha_acao).
 * "Assinar" aqui só aparece com PlugSign:WaySignAssinarHabilitado; senão, "Assinar na PlugSign" (link dele).
 */
export default function WaySignPlugSignAcoes({
  item,
  isAdmin,
  assinarHabilitado = false,
  onAssinado,
}: {
  item: ItemWaySign
  isAdmin: boolean
  assinarHabilitado?: boolean
  onAssinado?: () => void
}) {
  const documentKey = item.document_key ?? ''
  const titulo = nomeExibicao(item.nome, documentKey)
  const pendente = item.situacao_waysign === 'PENDENTE'
  const podePdf = item.situacao_waysign === 'CONCLUÍDO' || item.pdf_no_papersign
  const podeLembrete = pendente && (item.eu_remetente || isAdmin)

  const [detalhesOpen, setDetalhesOpen] = useState(false)
  const [lembreteBusy, setLembreteBusy] = useState(false)
  const [acaoPdf, setAcaoPdf] = useState<'ver' | 'baixar' | 'imprimir' | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfTitle, setPdfTitle] = useState('Documento assinado')
  const [assinando, setAssinando] = useState(false)
  const [confirmarAssinar, setConfirmarAssinar] = useState(false)

  async function abrirNaPlugSign() {
    if (!documentKey) return
    setAssinando(true)
    try {
      const res = await obterMinhaAssinaturaPlugSign(documentKey)
      window.open(res.linkPlugSign, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível obter o link de assinatura.')
    } finally {
      setAssinando(false)
    }
  }

  async function assinarAqui() {
    if (!documentKey) return
    setConfirmarAssinar(false)
    setAssinando(true)
    const toastId = toast.loading('Assinando na PlugSign com o seu certificado…')
    try {
      const msg = await assinarSolicitacaoPlugSign(documentKey)
      toast.dismiss(toastId)
      toast.success(msg)
      onAssinado?.()
    } catch (e) {
      toast.dismiss(toastId)
      toast.error(e instanceof Error ? e.message : 'Falha ao assinar.')
    } finally {
      setAssinando(false)
    }
  }

  async function enviarLembrete() {
    if (!documentKey) return
    setLembreteBusy(true)
    try {
      const res = await enviarLembreteSolicitacao(documentKey, {
        assunto: titulo ? `Lembrete de assinatura: ${titulo}` : 'Lembrete de assinatura pendente',
        mensagem:
          'Lembrete: há uma solicitação de assinatura pendente. Acesse o link do e-mail original na PlugSign para assinar o documento.',
      })
      toast.success(res.message || 'Lembrete enviado.')
      if (res.erros && res.erros.length > 0) {
        toast.warning(res.erros.slice(0, 2).join(' | '))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao enviar lembrete.')
    } finally {
      setLembreteBusy(false)
    }
  }

  async function acaoNoPdf(acao: 'ver' | 'baixar' | 'imprimir') {
    if (!documentKey) return
    setAcaoPdf(acao)
    try {
      const res = await baixarDocumentoAssinadoSolicitacao(documentKey, item.nome || 'documento-assinado.pdf')
      if (acao === 'ver') {
        setPdfTitle(res.nome || item.nome || 'Documento assinado')
        setPdfBase64(res.base64)
        setPdfOpen(true)
      } else if (acao === 'baixar') {
        const nome = res.nome || 'assinado.pdf'
        const result = await baixarBase64(res.base64, nome)
        toast.success(res.message || mensagemDownloadSucesso(result, nome))
      } else {
        imprimirPdfBase64(base64ParaImpressao(res.base64))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao obter o PDF assinado.')
    } finally {
      setAcaoPdf(null)
    }
  }

  const busy = acaoPdf != null

  return (
    <div className="flex flex-wrap gap-2">
      {item.minha_acao && assinarHabilitado && (
        <Button
          size="sm"
          className="bg-green-500 hover:bg-green-600 text-white"
          disabled={assinando}
          onClick={() => setConfirmarAssinar(true)}
          title="Assinar com o seu certificado A1"
        >
          {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
          Assinar
        </Button>
      )}
      {item.minha_acao && !assinarHabilitado && (
        <Button
          size="sm"
          variant="outline"
          disabled={assinando}
          onClick={abrirNaPlugSign}
          title="Abrir a sua assinatura na PlugSign"
        >
          {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          Assinar na PlugSign
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => setDetalhesOpen(true)} title="Signatários, histórico e ações">
        <History className="w-4 h-4" />
        Detalhes
      </Button>
      {podeLembrete && (
        <Button
          size="sm"
          variant="outline"
          disabled={lembreteBusy}
          onClick={enviarLembrete}
          title="Enviar lembrete por e-mail aos pendentes"
        >
          {lembreteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Lembrete
        </Button>
      )}
      {podePdf && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => acaoNoPdf('ver')} title="Visualizar PDF assinado">
            {acaoPdf === 'ver' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Documento
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => acaoNoPdf('baixar')} title="Baixar PDF assinado">
            {acaoPdf === 'baixar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => acaoNoPdf('imprimir')} title="Imprimir PDF assinado">
            {acaoPdf === 'imprimir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimir
          </Button>
        </>
      )}

      <Dialog open={confirmarAssinar} onOpenChange={setConfirmarAssinar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assinar documento</DialogTitle>
            <DialogDescription>
              {titulo ? `${titulo}. ` : ''}A assinatura usa o seu certificado A1 e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmarAssinar(false)}>
              Cancelar
            </Button>
            <Button className="bg-green-500 hover:bg-green-600 text-white" onClick={assinarAqui}>
              Assinar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WaySignDetalhesDialog
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        documentKey={documentKey}
        titulo={titulo}
        onAlterado={onAssinado}
      />

      <PdfViewerDialog
        open={pdfOpen}
        onOpenChange={(open) => {
          setPdfOpen(open)
          if (!open) setPdfBase64(null)
        }}
        title={pdfTitle}
        pdfBase64={pdfBase64}
        canSign={false}
        onPrint={() => pdfBase64 && imprimirPdfBase64(base64ParaImpressao(pdfBase64))}
        isLoading={false}
      />
    </div>
  )
}
