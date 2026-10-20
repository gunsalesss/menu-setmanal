import { useStore } from '../store'
import type { Slot } from '../core/types'

const SLOTS: { id: Slot; label: string }[] = [
  { id: 'dinar', label: 'Dinar' },
  { id: 'sopar', label: 'Sopar' },
]

const DAY_NAMES = ['Dg', 'Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds']
function weekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
function label(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${DAY_NAMES[weekday(iso)]} ${d}/${m}`
}

export function AttendanceGrid() {
  const { attendance, toggleAttendee, toggleMatch, people } = useStore()
  return (
    <div className="table-scroll">
    <table className="grid">
      <thead>
        <tr>
          <th>Dia</th>
          {SLOTS.map((s) => <th key={s.id} colSpan={people.length}>{s.label}</th>)}
        </tr>
        <tr>
          <th></th>
          {SLOTS.flatMap((s) =>
            people.map((p) => <th key={s.id + p.id} className="sub">{p.name}</th>),
          )}
        </tr>
      </thead>
      <tbody>
        {attendance.map((day) => {
          const isWeekend = weekday(day.date) === 0 || weekday(day.date) === 6
          return (
          <tr key={day.date}>
            <td>
              <div className="day-cell">
                <span>{label(day.date)}</span>
                {isWeekend && (
                  <button
                    className={`match-btn ${day.match ? 'active' : ''}`}
                    title={day.match ? 'Treure partit' : 'Hi ha partit (dinar: arròs fregit)'}
                    onClick={() => toggleMatch(day.date)}
                  >
                    🏉
                  </button>
                )}
              </div>
            </td>
            {SLOTS.flatMap((s) =>
              people.map((p) => {
                const home = day[s.id].includes(p.id)
                return (
                  <td key={day.date + s.id + p.id}>
                    <button
                      className={`chip ${home ? 'home' : 'out'}`}
                      title={home ? `${p.name} menja a casa` : `${p.name} menja fora`}
                      onClick={() => toggleAttendee(day.date, s.id, p.id)}
                    >
                      {home ? '🏠' : '🚶'}
                    </button>
                  </td>
                )
              }),
            )}
          </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}
