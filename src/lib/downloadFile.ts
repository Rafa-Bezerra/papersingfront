function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * Dispara download ou compartilhamento de arquivo (PDF, CSV, etc.) em desktop e mobile.
 */
export async function downloadBlobFile(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<'shared' | 'download' | 'opened'> {
  const name = (fileName || 'arquivo').trim()
  const type = mimeType || blob.type || 'application/octet-stream'
  const file = new File([blob], name, { type })

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

  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'download'
}
