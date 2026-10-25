import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { dishById } from '../core/dishes'
import type { FixChange } from '../core/nutrition'

const DAY_NAMES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
function dayLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]} ${d}/${m}`
}
const name = (id: string | null) => (id ? dishById(id)?.name ?? id : '—')

interface Props {
  title: string
  changes: FixChange[]
  onApply: (changes: FixChange[]) => void
  onClose: () => void
}

/** Review the swaps a nutritional fix suggests and pick which meals to apply. */
export function FixDialog({ title, changes, onApply, onClose }: Props) {
  // Group swaps by meal (day + slot): the user accepts or rejects whole meals.
  const meals: { key: string; date: string; slot: string; items: FixChange[] }[] = []
  for (const c of changes) {
    const key = `${c.date}|${c.slot}`
    const m = meals.find((x) => x.key === key)
    if (m) m.items.push(c)
    else meals.push({ key, date: c.date, slot: c.slot, items: [c] })
  }

  const [selected, setSelected] = useState<Set<string>>(() => new Set(meals.map((m) => m.key)))
  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const apply = () => onApply(changes.filter((c) => selected.has(`${c.date}|${c.slot}`)))

  return createPortal(
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker fix-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Canvis suggerits · {title}</strong>
          <button className="picker-x" onClick={onClose} aria-label="Tancar">✕</button>
        </div>

        {meals.length === 0 ? (
          <p className="muted">No s'ha trobat cap canvi possible amb els plats d'aquesta temporada.</p>
        ) : (
          <>
            <p className="fix-hint">Tria quins àpats vols canviar:</p>
            <ul className="fix-list">
              {meals.map((m) => (
                <li key={m.key}>
                  <label className={selected.has(m.key) ? '' : 'off'}>
                    <input
                      type="checkbox"
                      checked={selected.has(m.key)}
                      onChange={() => toggle(m.key)}
                    />
                    <span className="fix-meal">
                      <strong>{dayLabel(m.date)} · {m.slot === 'dinar' ? 'Dinar' : 'Sopar'}</strong>
                      {m.items.map((c) => (
                        <span key={c.course} className="fix-swap">
                          <span className="fix-course">{c.course === 'primer' ? 'Primer' : 'Segon'}</span>
                          <span className="fix-from">{name(c.fromId)}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="fix-to">{name(c.toId)}</span>
                        </span>
                      ))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="fix-actions">
          <button onClick={onClose}>Cancel·lar</button>
          {meals.length > 0 && (
            <button className="rule-fix" onClick={apply} disabled={selected.size === 0}>
              Aplicar ({selected.size})
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
