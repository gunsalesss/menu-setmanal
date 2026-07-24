import { useState } from 'react'
import { ALL_DISHES } from '../core/dishes'
import { SEASON_LABELS } from '../core/season'

/** Accent/case-insensitive substring match. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Browse any dish and see its ingredients (and steps, if any). */
export function DishExplorer() {
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nq = norm(q)
  const matches = ALL_DISHES
    .filter((d) => (nq ? norm(d.name).includes(nq) : true))
    .sort((a, b) => a.name.localeCompare(b.name))

  const dish = selectedId ? ALL_DISHES.find((d) => d.id === selectedId) ?? null : null

  return (
    <div className="explorer">
      <input
        className="explorer-search"
        placeholder="Cerca un plat…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setSelectedId(null) }}
      />

      {!dish && (
        <ul className="explorer-list">
          {matches.map((d) => (
            <li key={d.id}>
              <button onClick={() => setSelectedId(d.id)}>{d.name}</button>
            </li>
          ))}
          {matches.length === 0 && <li className="muted explorer-empty">Cap plat trobat</li>}
        </ul>
      )}

      {dish && (
        <div className="explorer-detail">
          <button className="explorer-back" onClick={() => setSelectedId(null)}>← Tornar</button>
          <h3>{dish.name}</h3>
          <p className="explorer-meta">
            {dish.course.map((c) => (c === 'primer' ? 'Primer' : 'Segon')).join(' / ')}
            {' · '}
            {dish.seasons.map((s) => SEASON_LABELS[s]).join(', ')}
            {' · '}per {dish.servingsBase} racions
          </p>
          <strong>Ingredients</strong>
          <ul className="explorer-ings">
            {dish.ingredients.map((i, k) => (
              <li key={k}>
                {i.item}
                {i.qty != null && <span className="qty"> · {i.qty}{i.unit ? ' ' + i.unit : ''}</span>}
              </li>
            ))}
          </ul>
          {dish.steps && dish.steps.length > 0 && (
            <>
              <strong>Preparació</strong>
              <ol className="explorer-steps">
                {dish.steps.map((s, k) => <li key={k}>{s}</li>)}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}
