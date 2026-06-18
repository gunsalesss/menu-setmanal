import { useStore } from '../store'
import type { Slot } from '../core/types'
import { PEOPLE } from '../core/types'

const SLOTS: { id: Slot; label: string }[] = [
  { id: 'dinar', label: 'Dinar' },
  { id: 'sopar', label: 'Sopar' },
]

const DAY_NAMES = ['Dg', 'Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds']
function label(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${DAY_NAMES[new Date(y, m - 1, d).getDay()]} ${d}/${m}`
}

export function AttendanceGrid() {
  const { attendance, toggleAttendee, names } = useStore()
  return (
    <div className="table-scroll">
    <table className="grid">
      <thead>
        <tr>
          <th>Dia</th>
          {SLOTS.map((s) => <th key={s.id} colSpan={2}>{s.label}</th>)}
        </tr>
        <tr>
          <th></th>
          {SLOTS.flatMap((s) => PEOPLE.map((p) => <th key={s.id + p} className="sub">{names[p]}</th>))}
        </tr>
      </thead>
      <tbody>
        {attendance.map((day) => (
          <tr key={day.date}>
            <td>{label(day.date)}</td>
            {SLOTS.flatMap((s) =>
              PEOPLE.map((p) => {
                const home = day[s.id].includes(p)
                return (
                  <td key={day.date + s.id + p}>
                    <button
                      className={`chip ${home ? 'home' : 'out'}`}
                      title={home ? `${names[p]} menja a casa` : `${names[p]} menja fora`}
                      onClick={() => toggleAttendee(day.date, s.id, p)}
                    >
                      {home ? '🏠' : '🚶'}
                    </button>
                  </td>
                )
              }),
            )}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
