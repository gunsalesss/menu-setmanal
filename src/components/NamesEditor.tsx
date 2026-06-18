import { useState } from 'react'
import { useStore } from '../store'

/** Inline editor for the two people's display names (used everywhere). */
export function NamesEditor() {
  const names = useStore((s) => s.names)
  const setName = useStore((s) => s.setName)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button className="names-btn" onClick={() => setOpen(true)}>
        ✏️ {names.adria} &amp; {names.helena}
      </button>
    )
  }

  return (
    <div className="names-editor row">
      <input
        aria-label="Nom 1"
        value={names.adria}
        onChange={(e) => setName('adria', e.target.value)}
      />
      <input
        aria-label="Nom 2"
        value={names.helena}
        onChange={(e) => setName('helena', e.target.value)}
      />
      <button onClick={() => setOpen(false)}>Fet</button>
    </div>
  )
}
