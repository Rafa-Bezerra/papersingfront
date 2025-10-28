import { differenceInYears, format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import SignatureCanvas from "react-signature-canvas";

export type BadgeStatus = 'active' | 'pending' | 'expired' | 'atendendo'

export function stripDiacritics(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function maskCPF(cpf?: string) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length < 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`
}

export function safeDate(iso?: string) {
  if (!iso) return null
  try {
    const dt = parseISO(iso)
    return isValid(dt) ? dt : null
  } catch {
    return null
  }
}

export function safeDateLabel(iso?: string) {
  const dt = safeDate(iso)
  return dt ? format(dt, 'dd/MM/yyyy', { locale: ptBR }) : '—'
}

export function safeDateTimeLabel(iso?: string) {
  const dt = safeDate(iso);
  return dt ? format(dt, "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
}

export function safeTimeLabel(iso?: string) {
  const dt = safeDate(iso);
  return dt ? format(dt, "HH:mm", { locale: ptBR }) : "—";
}

export function ageFromISO(iso?: string) {
  const dt = safeDate(iso)
  if (!dt) return null
  const age = differenceInYears(new Date(), dt)
  return age >= 0 ? age : null
}

export function waitingTime(iso?: string) {
  const dt = safeDate(iso);
  if (!dt) return "—";

  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();

  // converte em minutos
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

export function badgeClass(status: BadgeStatus): string {
  switch (status) {
    case 'active':
      return 'bg-black text-white border-black hover:bg-black'
    case 'expired':
      return 'bg-zinc-100 text-zinc-500 border-zinc-200 opacity-70'
    case 'atendendo':
      return 'border border-green-800 text-green-800 bg-green-100'
    case 'pending':
    default:
      return 'border border-zinc-500 text-zinc-700 bg-transparent'
  }
}

export const statusMap: Record<string, string> = {
  'A': "Em Andamento",
  'R': "Concluído a responder",
  'O': "Concluído respondido",
  'F': "Concluído confirmado",
  'U': "Concluído automático (pelo sistema)",
  'V': "Avaliado",
  'G': "Agendado a responder",
  'E': "Agendado respondido",
  'T': "Aguardando terceiros",
  'C': "Cancelado",
  'D': "Despertado",
};

export function getStatusDescricao(cod: string): string {
  return statusMap[cod] ?? "Sem status";
}

export function base64ToBlob(base64: string, type: string) {
  // Decodifica o Base64 para string binária
  const binary = atob(base64)

  // Cria um array de bytes
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i)
  }

  // Retorna um Blob do tipo especificado
  return new Blob([array], { type })
}

export function getTrimmedImage(sig: SignatureCanvas | null): string | null {
  if (!sig) return null;
  const canvas = sig.getCanvas();
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx?.getImageData(0, 0, width, height);
  if (!imgData) return null;

  // Encontrar limites da assinatura
  let top = 0, left = 0, right = width, bottom = height;
  const pixels = imgData.data;
  let x, y;
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        top = y;
        y = height;
        break;
      }
    }
  }
  for (y = height - 1; y >= 0; y--) {
    for (x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        bottom = y;
        y = -1;
        break;
      }
    }
  }
  for (x = 0; x < width; x++) {
    for (y = 0; y < height; y++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        left = x;
        x = width;
        break;
      }
    }
  }
  for (x = width - 1; x >= 0; x--) {
    for (y = 0; y < height; y++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        right = x;
        x = -1;
        break;
      }
    }
  }

  const trimmedWidth = right - left;
  const trimmedHeight = bottom - top;
  const trimmed = document.createElement("canvas");
  trimmed.width = trimmedWidth;
  trimmed.height = trimmedHeight;
  trimmed
    .getContext("2d")
    ?.putImageData(ctx!.getImageData(left, top, trimmedWidth, trimmedHeight), 0, 0);

  return trimmed.toDataURL("image/png");
}

export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function rotinaTipoMovimento(tipo_movimento: string | null | undefined): string {
  if (!tipo_movimento) return "Desconhecida";
  const mapa: Record<string, string> = {
    '1.2.31': 'Aquisição de materiais',
    '1.2.32': 'Aquisição de materiais',
    '1.2.33': 'Aquisição de materiais',
    '1.2.34': 'Aquisição de materiais',
    '1.2.35': 'Aquisição de materiais',
    '1.2.42': 'Controle imobilizado',
    '1.2.44': 'Controle imobilizado',
    '1.2.47': 'Controle imobilizado',
    '1.2.48': 'Controle imobilizado',
    "1.1.20": "Ordens de compra",
    "1.1.21": "Ordens de compra",
    "1.1.22": "Ordens de compra",
    "1.1.30": "Ordens de compra",
    "1.1.31": "Ordens de compra",
    "1.1.32": "Ordens de compra",
    "1.1.33": "Ordens de compra",
    "1.1.34": "Ordens de compra",
    "1.1.35": "Ordens de compra",
    "1.1.36": "Ordens de compra",
    "1.1.37": "Ordens de compra",
    "1.1.40": "Ordens de compra",
    "1.1.50": "Ordens de compra",
    "1.1.51": "Ordens de compra",
    '1.2.40': 'Recebimento de materiais',
    '1.2.41': 'Recebimento de materiais',
    '1.2.45': 'Recebimento de materiais',
    '1.2.46': 'Recebimento de materiais',
    '1.2.49': 'Recebimento de materiais',
    '1.2.70': 'Recebimento de materiais',
    '1.1.01': 'Solicitações de compra',
    '1.1.02': 'Solicitações de compra',
    '1.1.04': 'Solicitações de compra',
    '1.1.05': 'Solicitações de compra',
    '1.1.10': 'Solicitações de compra',
    '1.1.11': 'Solicitações de compra',
    '1.1.12': 'Solicitações de compra',
    '1.2.43': 'Outras movimentações',
    '1.2.60': 'Outras movimentações',
    '1.2.61': 'Outras movimentações',
    '1.2.62': 'Outras movimentações',
    '1.2.64': 'Outras movimentações',
    '1.2.65': 'Outras movimentações',
    '1.2.90': 'Outras movimentações',
  };
  return mapa[tipo_movimento] ?? "Desconhecida";
}