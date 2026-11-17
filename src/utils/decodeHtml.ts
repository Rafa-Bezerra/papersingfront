/** Decodifica entidades HTML (&atilde; → ã) só para exibir. Sem dangerouslySetInnerHTML. */
export function decodeHtml(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  if (!s.includes('&')) return s
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea')
    el.innerHTML = s
    const once = el.value
    if (!once.includes('&')) return once
    el.innerHTML = once
    return el.value
  }
  // SSR / Node: cobrir as entidades mais comuns da PlugSign
  return s
    .replace(/&amp;/g, '&')
    .replace(/&atilde;/gi, 'ã')
    .replace(/&Atilde;/g, 'Ã')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&otilde;/gi, 'õ')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}
