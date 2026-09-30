export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function triggerAnchorDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Dispara download ou compartilhamento de arquivo (PDF, CSV, etc.).
 * Desktop: sempre pasta de Downloads do navegador. Mobile: compartilhar ou abrir quando necessário.
 */
export async function downloadBlobFile(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<'shared' | 'download' | 'opened'> {
  const name = (fileName || 'arquivo').trim()
  const type = mimeType || blob.type || 'application/octet-stream'
  const file = new File([blob], name, { type })

  if (!isMobileDevice()) {
    triggerAnchorDownload(blob, name)
    return 'download'
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name })
        return 'shared'
      }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(blob)

  if (isIos()) {
    const opened = window.open(url, '_blank')
    if (!opened) {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
    return 'opened'
  }

  triggerAnchorDownload(blob, name)
  return 'download'
}
