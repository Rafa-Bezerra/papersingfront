export type DownloadResult = "saved" | "opened" | "shared";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function garantirExtensao(nome: string, mime: string): string {
  const n = nome.trim() || "arquivo";
  if (/\.[a-z0-9]+$/i.test(n)) return n;
  if (mime.includes("pdf")) return `${n}.pdf`;
  if (mime.includes("zip")) return `${n}.zip`;
  if (mime.includes("png")) return `${n}.png`;
  if (mime.includes("jpeg") || mime.includes("jpg")) return `${n}.jpg`;
  return n;
}

async function tentarCompartilharArquivo(blob: Blob, filename: string): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    const file = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }
}

function abrirEmNovaAba(url: string): boolean {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return true;

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

/** Baixa ou abre arquivo de forma compatível com desktop, tablet e celular. */
export async function baixarBlob(blob: Blob, filename: string): Promise<DownloadResult> {
  const nome = garantirExtensao(filename, blob.type || "application/octet-stream");

  if (isIOS()) {
    const shared = await tentarCompartilharArquivo(blob, nome);
    if (shared) return "shared";

    const url = URL.createObjectURL(blob);
    abrirEmNovaAba(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return "opened";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}

export function dataUrlParaBlob(dataUrl: string): Blob {
  const normalizado = dataUrl.trim();
  const mimeMatch = normalizado.match(/^data:([^;]+);/);
  const mime = mimeMatch?.[1] ?? "application/octet-stream";
  const base64 = normalizado.includes(",")
    ? normalizado.split(",")[1] ?? ""
    : normalizado.replace(/^data:.*;base64,/, "");

  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function baixarDataUrl(dataUrl: string, filename: string): Promise<DownloadResult> {
  return baixarBlob(dataUrlParaBlob(dataUrl), filename);
}

export async function baixarBase64(
  base64: string,
  filename: string,
  mime = "application/pdf"
): Promise<DownloadResult> {
  const dataUrl = base64.trim().startsWith("data:")
    ? base64.trim()
    : `data:${mime};base64,${base64.replace(/^data:.*;base64,/, "")}`;
  return baixarDataUrl(dataUrl, filename);
}

export function mensagemDownloadSucesso(result: DownloadResult, nomeArquivo?: string): string {
  const nome = nomeArquivo?.trim() || "arquivo";
  switch (result) {
    case "shared":
      return `Compartilhamento aberto — escolha "Salvar em Arquivos" para guardar ${nome}.`;
    case "opened":
      return `Arquivo aberto — toque em Compartilhar e salve ${nome} no tablet/celular.`;
    default:
      return `Download iniciado: ${nome}`;
  }
}
