import { useState } from 'react'
import { useStore } from '../store'
import { dishById } from '../core/dishes'
import { DishPicker } from './DishPicker'
import type { Course, PlannedMeal, Slot } from '../core/types'

const DAY_NAMES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']
function weekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
function label(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${DAY_NAMES[weekday(iso)]} ${d}/${m}`
}

/** Weekend "match day" toggle: forces lunch to the match-day dish. */
function MatchToggle({ date, on }: { date: string; on: boolean }) {
  const toggleMatch = useStore((s) => s.toggleMatch)
  return (
    <button
      className={`match-btn ${on ? 'active' : ''}`}
      title={on ? 'Treure partit (regenerar dinar)' : 'Hi ha partit (dinar: arròs fregit)'}
      onClick={() => toggleMatch(date)}
    >
      🏉
    </button>
  )
}

function CourseRow(
  { date, slot, course, dishId, isSingle, onToggleSingle }:
  {
    date: string; slot: Slot; course: Course; dishId: string | null
    isSingle: boolean; onToggleSingle: () => void
  },
) {
  const reroll = useStore((s) => s.reroll)
  const setDish = useStore((s) => s.setDish)
  const [picking, setPicking] = useState(false)
  const dish = dishId ? dishById(dishId) : null
  const cap = course === 'primer' ? 'Primer' : 'Segon'
  return (
    <div className="course">
      <span className="course-label">{cap}</span>
      <span className="course-name">{dish?.name ?? '—'}</span>
      <span className="course-actions">
        <button className="reroll" title={`Canviar ${course} a l'atzar`} onClick={() => reroll(date, slot, course)}>🎲</button>
        <button className="reroll" title={`Triar ${course}`} onClick={() => setPicking(true)}>✏️</button>
        <button
          className={`reroll ${isSingle ? 'active' : ''}`}
          title={isSingle ? 'Tornar a dos plats' : 'Fer plat únic'}
          onClick={onToggleSingle}
        >
          {isSingle ? '②' : '①'}
        </button>
      </span>
      {picking && (
        <DishPicker
          course={course}
          currentId={dishId}
          onPick={(id) => { setDish(date, slot, course, id); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

function MealCell({ date, slot, meal }: { date: string; slot: Slot; meal: PlannedMeal }) {
  const people = useStore((s) => s.people)
  const toggleSingle = useStore((s) => s.toggleSingle)
  if (meal.attendees.length === 0) return <span className="muted">— fora —</span>
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id
  return (
    <div className="meal">
      {meal.single !== 'segon' && (
        <CourseRow
          date={date} slot={slot} course="primer" dishId={meal.primerId}
          isSingle={meal.single === 'primer'} onToggleSingle={() => toggleSingle(date, slot, 'primer')}
        />
      )}
      {meal.single !== 'primer' && (
        <CourseRow
          date={date} slot={slot} course="segon" dishId={meal.segonId}
          isSingle={meal.single === 'segon'} onToggleSingle={() => toggleSingle(date, slot, 'segon')}
        />
      )}
      <div className="meal-foot">
        <span className="who" title={meal.attendees.map(nameOf).join(' + ')}>
          {meal.attendees.map((p) => nameOf(p)[0]?.toUpperCase()).join('+')}
        </span>
      </div>
    </div>
  )
}

export function MenuView() {
  const menu = useStore((s) => s.menu)
  if (!menu) return null
  return (
    <div className="table-scroll">
      <table className="grid menu" id="menu-grid">
        <thead><tr><th>Dia</th><th>Dinar</th><th>Sopar</th></tr></thead>
        <tbody>
          {menu.days.map((d) => {
            const dow = weekday(d.date)
            const isWeekend = dow === 0 || dow === 6
            return (
              <tr key={d.date}>
                <td>
                  <div className="day-cell">
                    <span>{label(d.date)}</span>
                    {isWeekend && <MatchToggle date={d.date} on={!!d.match} />}
                  </div>
                </td>
                <td><MealCell date={d.date} slot="dinar" meal={d.dinar} /></td>
                <td><MealCell date={d.date} slot="sopar" meal={d.sopar} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
