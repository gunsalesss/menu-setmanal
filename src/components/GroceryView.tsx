import { useStore } from '../store'
import { buildGroceryList, CATEGORY_LABELS } from '../core/grocery'
import type { GroceryCategory } from '../core/types'

export function GroceryView() {
  const menu = useStore((s) => s.menu)
  if (!menu) return null
  const grouped = buildGroceryList(menu)
  const cats = Object.keys(grouped) as GroceryCategory[]
  return (
    <div className="grocery">
      {cats.map((cat) => (
        <div key={cat} className="grocery-cat">
          <h3>{CATEGORY_LABELS[cat]}</h3>
          <ul>
            {grouped[cat].map((it, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" />
                  {it.item}
                  {it.qty != null && <span className="qty"> · {it.qty}{it.unit ? ' ' + it.unit : ''}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
