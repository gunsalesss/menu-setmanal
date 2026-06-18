import { useStore } from '../store'
import { dishById } from '../core/dishes'
import type { PlannedMeal, Slot } from '../core/types'

const DAY_NAMES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
function label(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]} ${d}/${m}`
}

function MealCell({ date, slot, meal }: { date: string; slot: Slot; meal: PlannedMeal }) {
  const reroll = useStore((s) => s.reroll)
  if (meal.attendees.length === 0) return <span className="muted">— fora —</span>
  const dish = meal.dishId ? dishById(meal.dishId) : null
  return (
    <div className="meal">
      <span>{dish?.name ?? '—'}</span>
      <span className="who">{meal.attendees.map((p) => (p === 'adria' ? 'A' : 'H')).join('+')}</span>
      <button className="reroll" title="Canviar plat" onClick={() => reroll(date, slot)}>🎲</button>
    </div>
  )
}

export function MenuView() {
  const menu = useStore((s) => s.menu)
  if (!menu) return null
  return (
    <table className="grid menu">
      <thead><tr><th>Dia</th><th>Dinar</th><th>Sopar</th></tr></thead>
      <tbody>
        {menu.days.map((d) => (
          <tr key={d.date}>
            <td>{label(d.date)}</td>
            <td><MealCell date={d.date} slot="dinar" meal={d.dinar} /></td>
            <td><MealCell date={d.date} slot="sopar" meal={d.sopar} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
