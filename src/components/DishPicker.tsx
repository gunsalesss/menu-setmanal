import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ALL_DISHES } from '../core/dishes'
import { SEASON_LABELS } from '../core/season'
import type { Course } from '../core/types'

/** Accent/case-insensitive substring match for the search box. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

interface Props {
  course: Course
  currentId: string | null
  onPick: (dishId: string) => void
  onClose: () => void
}

export function DishPicker({ course, currentId, onPick, onClose }: Props) {
  const [q, setQ] = useState('')
  const nq = norm(q)
  // Any dish usable for this course, from any season; filtered by the query.
  const matches = ALL_DISHES
    .filter((d) => d.course.includes(course))
    .filter((d) => (nq ? norm(d.name).includes(nq) : true))
    .sort((a, b) => a.name.localeCompare(b.name))

  const overlayRef = useRef<HTMLDivElement>(null)

  // Lock background scroll while the picker is open and close on Escape.
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

  // Keep the sheet within the visual viewport (the area not covered by the
  // on-screen keyboard), so a short result list isn't hidden behind it.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const apply = () => {
      const el = overlayRef.current
      if (!el) return
      el.style.top = `${vv.offsetTop}px`
      el.style.height = `${vv.height}px`
      el.style.bottom = 'auto'
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
    }
  }, [])

  // Rendered through a portal at <body> so the horizontally-scrolled menu
  // table (or any transformed ancestor) can't offset/clip the fixed overlay.
  return createPortal(
    <div className="picker-overlay" ref={overlayRef} onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Tria un {course}</strong>
          <button className="picker-x" onClick={onClose} aria-label="Tancar">✕</button>
        </div>
        <div className="picker-search-wrap">
          <span className="picker-search-icon" aria-hidden="true">🔍</span>
          <input
            autoFocus
            className="picker-search"
            placeholder="Cerca un plat…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="picker-list">
          {matches.map((d) => (
            <li key={d.id}>
              <button
                className={d.id === currentId ? 'current' : ''}
                onClick={() => onPick(d.id)}
              >
                <span className="picker-name">{d.name}</span>
                <span className="picker-seasons">
                  {d.seasons.map((s) => SEASON_LABELS[s]).join(' · ')}
                </span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="muted picker-empty">Cap plat trobat</li>}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
