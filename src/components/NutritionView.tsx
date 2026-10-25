import { useState } from 'react'
import { useStore } from '../store'
import { checkNutrition, proposeFix, type FixChange } from '../core/nutrition'
import { FixDialog } from './FixDialog'

export function NutritionView() {
  const menu = useStore((s) => s.menu)
  const applyNutritionFix = useStore((s) => s.applyNutritionFix)
  // The fix being reviewed: computed once on click so the suggestion stays stable.
  const [pending, setPending] = useState<{ title: string; changes: FixChange[] } | null>(null)
  if (!menu) return null
  const results = checkNutrition(menu)
  const warnings = results.filter((r) => r.status === 'warn').length

  return (
    <div className="nutrition">
      <p className="hint">
        {warnings === 0
          ? 'Tot equilibrat ✅'
          : `${warnings} ${warnings === 1 ? 'avís' : 'avisos'} a revisar`}
      </p>
      <ul>
        {results.map((r) => (
          <li key={r.id} className={r.status}>
            <span className="rule-icon">{r.status === 'ok' ? '✅' : '⚠️'}</span>
            <span className="rule-text">
              <strong>{r.label}</strong>
              <span className="rule-detail">{r.detail}</span>
            </span>
            {r.status === 'warn' && r.id !== 'empty' && (
              <button
                className="rule-fix"
                onClick={() => setPending({ title: r.label, changes: proposeFix(menu, r.id) })}
              >
                Arreglar
              </button>
            )}
          </li>
        ))}
      </ul>
      {pending && (
        <FixDialog
          title={pending.title}
          changes={pending.changes}
          onApply={(changes) => { applyNutritionFix(changes); setPending(null) }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  )
}
