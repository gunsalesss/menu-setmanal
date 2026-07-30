import { useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store'
import { menuToText, groceryToText } from '../core/export'

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

/** A read-only text box with its own copy-to-clipboard button. */
function CopyBox(
  { title, text, rows, control }:
  { title: string; text: string; rows: number; control?: ReactNode },
) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  // Opens WhatsApp (app or web) with the text prefilled so the user picks a chat.
  const sendWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  return (
    <div className="copybox">
      <div className="row">
        <strong>{title}</strong>
        {control}
        <button className="wa-btn" onClick={sendWhatsApp}><WhatsAppIcon /> Enviar</button>
        <button className="copy-btn" onClick={copy}>{copied ? 'Copiat! ✅' : 'Copiar'}</button>
      </div>
      <textarea readOnly value={text} rows={rows} />
    </div>
  )
}

/** Capture the on-screen menu grid as a PNG and share it (WhatsApp on mobile). */
async function shareMenuPhoto() {
  const el = document.getElementById('menu-grid')
  if (!el) return
  el.classList.add('capturing') // hide the per-course action buttons
  try {
    const { default: html2canvas } = await import('html2canvas') // lazy-loaded
    const bg = getComputedStyle(document.body).backgroundColor || '#fff'
    const canvas = await html2canvas(el, { backgroundColor: bg, scale: 2 })
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) return
    const file = new File([blob], 'menu-setmanal.png', { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
    // On touch devices the native share sheet includes WhatsApp — use it.
    const isTouch = matchMedia('(pointer: coarse)').matches
    if (isTouch && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Menú setmanal' })
    } else {
      // Desktop: WhatsApp Web can't be handed an image via the web, so we
      // download the photo and open WhatsApp Web to drag it into the chat.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'menu-setmanal.png'
      a.click()
      URL.revokeObjectURL(url)
      window.open('https://web.whatsapp.com/', '_blank', 'noopener')
    }
  } catch {
    /* user cancelled the share, or capture failed */
  } finally {
    el.classList.remove('capturing')
  }
}

export function TextExport() {
  const menu = useStore((s) => s.menu)
  const checked = useStore((s) => s.checkedGrocery)
  const people = useStore((s) => s.people)
  const extraItems = useStore((s) => s.extraItems)
  const [grouped, setGrouped] = useState(true)
  const [photoBusy, setPhotoBusy] = useState(false)
  if (!menu) return null

  const sharePhoto = async () => {
    if (photoBusy) return
    setPhotoBusy(true)
    await shareMenuPhoto()
    setPhotoBusy(false)
  }

  return (
    <div className="export">
      <CopyBox
        title="Menú"
        text={menuToText(menu, people)}
        rows={12}
        control={
          <button className="wa-btn" onClick={sharePhoto} disabled={photoBusy}>
            <WhatsAppIcon /> {photoBusy ? 'Preparant…' : 'Foto'}
          </button>
        }
      />
      {/* Items checked off in the grocery view are excluded from this list. */}
      <CopyBox
        title="Llista de la compra"
        text={groceryToText(menu, checked, grouped, extraItems)}
        rows={12}
        control={
          <button onClick={() => setGrouped((g) => !g)}>
            {grouped ? 'Llista simple' : 'Per seccions'}
          </button>
        }
      />
    </div>
  )
}
