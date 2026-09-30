import { downloadBlobFile } from '@/lib/downloadFile'
import { API_BASE, headers } from '@/utils/constants'

export type RelatorioMensalRef = {
  id: number
  titulo: string
  nomeSetor: string
  assinanteNome: string
  assinanteUnidade?: string
  assinanteLogin?: string
  assinanteCargo?: string
  colaboradores: RelatorioMensalColaboradorRef[]
  emailDestino: string
  emailCopia?: string
  logins: string[]
  envioAutomatico: boolean
  diaEnvio: number
  ultimoEnvioMesRef?: string
  criadoPor: string
  criadoEm: string
  ativo: boolean
}

function mapRef(r: Record<string, unknown>): RelatorioMensalRef {
  return {
    id: Number(r.id ?? r.Id ?? 0),
    titulo: String(r.titulo ?? r.Titulo ?? ''),
    nomeSetor: String(r.nomeSetor ?? r.NomeSetor ?? ''),
    assinanteNome: String(r.assinanteNome ?? r.AssinanteNome ?? ''),
    assinanteUnidade: (r.assinanteUnidade ?? r.AssinanteUnidade) as string | undefined,
    assinanteLogin: (r.assinanteLogin ?? r.AssinanteCodusuario ?? r.assinanteCodusuario) as
      | string
      | undefined,
    assinanteCargo: (r.assinanteCargo ?? r.AssinanteCargo) as string | undefined,
    emailDestino: String(r.emailDestino ?? r.EmailDestino ?? ''),
    emailCopia: (r.emailCopia ?? r.EmailCopia) as string | undefined,
    logins: (r.logins ?? r.Logins ?? []) as string[],
    colaboradores: ((r.colaboradores ?? r.Colaboradores ?? []) as Record<string, unknown>[]).map(
      c => ({
        unidade: String(c.unidade ?? c.Unidade ?? ''),
        codusuario: String(c.codusuario ?? c.Codusuario ?? ''),
      })
    ),
    envioAutomatico: Boolean(r.envioAutomatico ?? r.EnvioAutomatico),
    diaEnvio: Number(r.diaEnvio ?? r.DiaEnvio ?? 1),
    ultimoEnvioMesRef: (r.ultimoEnvioMesRef ?? r.UltimoEnvioMesRef) as string | undefined,
    criadoPor: String(r.criadoPor ?? r.CriadoPor ?? ''),
    criadoEm: String(r.criadoEm ?? r.CriadoEm ?? ''),
    ativo: Boolean(r.ativo ?? r.Ativo ?? true),
  }
}

async function parseError(res: Response, fallback: string) {
  const text = await res.text()
  if (res.status === 404) {
    return (
      'Endpoint não encontrado (404). Atualize a API no servidor e reinicie o serviço local (dotnet run).'
    )
  }
  return text?.trim() || `${fallback} (${res.status})`
}

export async function listarReferenciasRelatorioMensal(): Promise<RelatorioMensalRef[]> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias`, { headers: headers() })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao listar referências'))
  const data = await res.json()
  return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => mapRef(r))
}

export async function obterReferenciaRelatorioMensal(id: number): Promise<RelatorioMensalRef> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias/${id}`, { headers: headers() })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao carregar preferência'))
  const data = await res.json()
  return mapRef(data as Record<string, unknown>)
}

export type RelatorioMensalColaboradorRef = {
  unidade: string
  codusuario: string
}

export type SalvarRelatorioMensalRefPayload = {
  titulo: string
  nomeSetor: string
  assinanteNome: string
  assinanteUnidade?: string
  assinanteCodusuario?: string
  assinanteCargo?: string
  emailDestino: string
  emailCopia?: string
  colaboradores: RelatorioMensalColaboradorRef[]
  envioAutomatico: boolean
  diaEnvio: number
  ativo?: boolean
}

export async function criarReferenciaRelatorioMensal(
  payload: SalvarRelatorioMensalRefPayload
): Promise<number> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao salvar referência'))
  const data = await res.json()
  return Number(data.id ?? data.Id ?? 0)
}

export async function atualizarReferenciaRelatorioMensal(
  id: number,
  payload: SalvarRelatorioMensalRefPayload
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao atualizar referência'))
}

export async function excluirReferenciaRelatorioMensal(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias/${id}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao excluir referência'))
}

export async function enviarRelatorioMensalEmail(payload: {
  email: string
  emailCopia?: string
  nomeSetor: string
  mesRef: string
  assinanteNome: string
  qtdColaboradores: number
  nomeArquivo: string
  pdfBase64: string
}): Promise<{ ok: boolean; enviadoPara: string[] }> {
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/email`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      email: payload.email,
      emailCopia: payload.emailCopia ?? '',
      nomeSetor: payload.nomeSetor,
      mesRef: payload.mesRef,
      assinanteNome: payload.assinanteNome,
      qtdColaboradores: payload.qtdColaboradores,
      nomeArquivo: payload.nomeArquivo,
      pdfBase64: payload.pdfBase64,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao enviar e-mail'))
  const data = await res.json()
  return {
    ok: Boolean(data.ok ?? data.Ok ?? true),
    enviadoPara: (data.enviadoPara ?? data.EnviadoPara ?? []) as string[],
  }
}

export async function baixarPdfReferenciaRelatorioMensal(id: number, mesRef?: string): Promise<void> {
  const qs = mesRef ? `?mesRef=${encodeURIComponent(mesRef)}` : ''
  const h = headers()
  delete h['Content-Type']
  const res = await fetch(`${API_BASE}/api/RelatorioMensalSetor/referencias/${id}/pdf${qs}`, {
    headers: h,
  })
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao baixar PDF'))
  const blob = await res.blob()
  const nome =
    res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ??
    `papersign-relatorio-mensal-${id}.pdf`
  await downloadBlobFile(blob, nome, 'application/pdf')
}

export async function enviarReferenciaRelatorioMensal(
  id: number,
  mesRef?: string,
  pdfBase64?: string
): Promise<string[]> {
  const res = await fetch(
    `${API_BASE}/api/RelatorioMensalSetor/referencias/${id}/enviar${mesRef ? `?mesRef=${encodeURIComponent(mesRef)}` : ''}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(pdfBase64 ? { pdfBase64 } : {}),
    }
  )
  if (!res.ok) throw new Error(await parseError(res, 'Erro ao enviar referência'))
  const data = await res.json()
  return (data.enviadoPara ?? data.EnviadoPara ?? []) as string[]
}
