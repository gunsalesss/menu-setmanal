import type {
  AttendanceDay, Course, Dish, Person, PlannedDay, PlannedMeal, Season, Slot, WeeklyMenu,
} from './types'
import { poolFor, dishById } from './dishes'
import { seasonForDate } from './season'

/** All dish ids chosen across a planned week (used to avoid repeats). */
function chosenIds(days: PlannedDay[]): string[] {
  return days
    .flatMap((d) => [d.dinar.primerId, d.dinar.segonId, d.sopar.primerId, d.sopar.segonId])
    .filter(Boolean) as string[]
}

const PROTEIN_TAGS = ['peix', 'carn', 'ou', 'llegum'] as const

/** Which protein tags a dish carries (used to vary protein across the day). */
function proteinTags(dishId: string | null): string[] {
  if (!dishId) return []
  const d = dishById(dishId)
  return d ? d.tags.filter((t) => (PROTEIN_TAGS as readonly string[]).includes(t)) : []
}

interface PickOpts {
  /** Protein tags to avoid (e.g. the one already used at lunch). */
  avoidProteins?: string[]
  /** A protein tag to favour (e.g. egg at dinner). */
  preferProtein?: string
}

/** Deterministic-but-shuffled pick driven by a seed so reruns vary. */
function pickWeighted(
  pool: Dish[],
  usedIds: string[],
  recentTags: string[],
  seed: number,
  opts: PickOpts = {},
): Dish | null {
  if (pool.length === 0) return null
  const scored = pool.map((d, i) => {
    let score = 1
    if (usedIds.includes(d.id)) score -= 0.8 // strongly avoid repeats
    // penalise repeating the same primary tag as recent days (variety)
    if (d.tags.some((t) => recentTags.includes(t))) score -= 0.3
    if (d.free) score -= 0.5 // keep "lliure" rare unless forced
    // favour a preferred protein (egg at dinner)
    if (opts.preferProtein && (d.tags as string[]).includes(opts.preferProtein)) score += 0.4
    // pseudo-random jitter from seed so rerolls differ
    const jitter = (Math.sin((seed + i) * 12.9898) * 43758.5453) % 1
    return { d, score: score + Math.abs(jitter) * 0.5 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].d
}

/** Day of week for an ISO date (0 = Sunday … 6 = Saturday), in local time. */
function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
const SUN = 0
const MON = 1
const FRI = 5

/**
 * Default fixed meals (the "first option" the generator proposes). The user can
 * still reroll away from these. Returns null when no rule applies.
 */
function fixedMeal(
  date: string,
  slot: Slot,
  attendees: Person[],
  season: Season,
  peopleCount: number,
): { primerId: string; segonId: string } | null {
  if (slot !== 'sopar') return null
  const dow = weekday(date)
  // Monday dinner, everyone at home → mongeta+pastanaga al vapor + salmó a la planxa.
  if (dow === MON && attendees.length === peopleCount) {
    return { primerId: 'mongeta-pastanaga-vapor', segonId: 'salmo-planxa' }
  }
  // Sunday dinner, at least one at home → caldo/gaspatxo + pinya, by season.
  if (dow === SUN && attendees.length >= 1) {
    const cold = season === 'hivern' || season === 'tardor'
    return { primerId: cold ? 'caldo-verdures' : 'gaspatxo', segonId: 'pinya-natural' }
  }
  // Friday dinner, at least one at home → hummus amb pastanaga + smash burger.
  if (dow === FRI && attendees.length >= 1) {
    return { primerId: 'hummus-pastanaga', segonId: 'smash-burger' }
  }
  return null
}

/** Drop reserved dishes from a pool, but never empty it. */
function withoutReserved(pool: Dish[], reserved: Set<string>): Dish[] {
  if (!reserved.size) return pool
  const filtered = pool.filter((d) => !reserved.has(d.id))
  return filtered.length ? filtered : pool
}

function planMeal(
  date: string,
  slot: Slot,
  attendees: Person[],
  season: Season,
  usedIds: string[],
  recentTags: string[],
  seed: number,
  peopleCount: number,
  reserved: Set<string>,
  segonOpts: PickOpts = {},
): PlannedMeal {
  if (attendees.length === 0) return { slot, attendees, primerId: null, segonId: null }
  const fixed = fixedMeal(date, slot, attendees, season, peopleCount)
  if (fixed) return { slot, attendees, ...fixed }
  const primer = pickWeighted(withoutReserved(poolFor(season, slot, 'primer'), reserved), usedIds, recentTags, seed)
  // Exclude the just-picked starter so the main is a different dish.
  const segonUsed = primer ? [...usedIds, primer.id] : usedIds
  // Hard-avoid the other meal's protein (fall back to the full pool if needed).
  let segonPool = withoutReserved(poolFor(season, slot, 'segon'), reserved)
  if (segonOpts.avoidProteins?.length) {
    const filtered = segonPool.filter((d) => !d.tags.some((t) => segonOpts.avoidProteins!.includes(t)))
    if (filtered.length) segonPool = filtered
  }
  const segon = pickWeighted(segonPool, segonUsed, recentTags, seed + 1, segonOpts)
  return { slot, attendees, primerId: primer?.id ?? null, segonId: segon?.id ?? null }
}

export function generateMenu(
  attendance: AttendanceDay[],
  // Base seed for the pseudo-random picks. Defaults to a random value so each
  // generation differs; pass an explicit seed when you need reproducibility (tests).
  baseSeed: number = Math.floor(Math.random() * 1e9),
  // How many people there are in total (used by the "everyone home" rule).
  peopleCount: number = 2,
): WeeklyMenu {
  const season = attendance.length ? seasonForDate(attendance[0].date) : 'estiu'
  const usedIds: string[] = []
  const days: PlannedDay[] = []
  let seed = baseSeed

  // Dishes the fixed rules will place (Monday, Sunday) are reserved so the
  // random picks don't repeat them elsewhere in the week.
  const reserved = new Set<string>()
  for (const day of attendance) {
    const f = fixedMeal(day.date, 'sopar', day.sopar, season, peopleCount)
    if (f) { reserved.add(f.primerId); reserved.add(f.segonId) }
  }

  for (const day of attendance) {
    const recentTags = chosenIds(days.slice(-2)).flatMap(
      (id) => dishById(id)?.tags ?? [],
    )

    const dinar = day.match && day.dinar.length
      ? matchMeal(day.dinar)
      : planMeal(day.date, 'dinar', day.dinar, season, usedIds, recentTags, seed, peopleCount, reserved)
    seed += 2
    usedIds.push(...[dinar.primerId, dinar.segonId].filter(Boolean) as string[])
    // Dinner avoids lunch's protein and prefers egg.
    const sopar = planMeal(day.date, 'sopar', day.sopar, season, usedIds, recentTags, seed, peopleCount, reserved, {
      avoidProteins: proteinTags(dinar.segonId),
      preferProtein: 'ou',
    })
    seed += 2
    usedIds.push(...[sopar.primerId, sopar.segonId].filter(Boolean) as string[])

    days.push({ date: day.date, dinar, sopar })
  }
  return { season, days }
}

/**
 * Re-sync an existing menu to updated attendance without regenerating it:
 * meals that lose all attendees are cleared, meals that gain attendees (were
 * skipped) get freshly filled, and meals that already had dishes keep them
 * (only their attendee list updates, so grocery quantities re-scale).
 */
export function syncMenu(
  menu: WeeklyMenu,
  attendance: AttendanceDay[],
  peopleCount = 2,
  baseSeed: number = Math.floor(Math.random() * 1e9),
): WeeklyMenu {
  const season = menu.season
  const byDate = new Map(attendance.map((a) => [a.date, a]))

  const reserved = new Set<string>()
  for (const a of attendance) {
    const f = fixedMeal(a.date, 'sopar', a.sopar, season, peopleCount)
    if (f) { reserved.add(f.primerId); reserved.add(f.segonId) }
  }

  const days: PlannedDay[] = menu.days.map((d) => ({ ...d }))
  const usedIds: string[] = []
  const toFill: { di: number; slot: Slot }[] = []

  days.forEach((day, di) => {
    const att = byDate.get(day.date)
    for (const slot of ['dinar', 'sopar'] as Slot[]) {
      const newAtt = att ? att[slot] : day[slot].attendees
      const old = menu.days[di][slot]
      const wantMatch = slot === 'dinar' && !!att?.match && newAtt.length > 0
      if (newAtt.length === 0) {
        day[slot] = { slot, attendees: [], primerId: null, segonId: null }
      } else if (wantMatch) {
        day[slot] = matchMeal(newAtt) // match day → forced single lunch
        usedIds.push(MATCH_LUNCH_ID)
      } else if ((old.primerId || old.segonId) && old.segonId !== MATCH_LUNCH_ID) {
        day[slot] = { ...old, attendees: [...newAtt] } // keep dishes, update who
        usedIds.push(...[old.primerId, old.segonId].filter(Boolean) as string[])
      } else {
        // empty before, or a match dish that's no longer wanted → refill normally
        day[slot] = { slot, attendees: [...newAtt], primerId: null, segonId: null }
        toFill.push({ di, slot })
      }
    }
  })

  let seed = baseSeed
  for (const { di, slot } of toFill) {
    const day = days[di]
    const opts = slot === 'sopar'
      ? { avoidProteins: proteinTags(day.dinar.segonId), preferProtein: 'ou' }
      : {}
    const filled = planMeal(day.date, slot, day[slot].attendees, season, usedIds, [], seed, peopleCount, reserved, opts)
    seed += 2
    usedIds.push(...[filled.primerId, filled.segonId].filter(Boolean) as string[])
    days[di][slot] = filled
  }
  return { season, days }
}

/** Re-pick a single course of a single meal, avoiding dishes used that week. */
export function rerollMeal(
  menu: WeeklyMenu,
  date: string,
  slot: Slot,
  course: Course,
  seed: number,
): WeeklyMenu {
  const usedIds = chosenIds(menu.days)
  const field = course === 'primer' ? 'primerId' : 'segonId'

  const days = menu.days.map((d) => {
    if (d.date !== date) return d
    const meal = d[slot]
    if (meal.attendees.length === 0) return d
    const current = meal[field]
    const pool = poolFor(menu.season, slot, course).filter((x) => x.id !== current)
    const next = pool.length ? pickFromExcluding(pool, usedIds, seed) : null
    return { ...d, [slot]: { ...meal, [field]: next?.id ?? current } }
  })
  return { ...menu, days }
}

/** The dish served for lunch on a weekend "match day". */
export const MATCH_LUNCH_ID = 'arros-fregit-gall-dindi'

/** The forced single-dish lunch for a match day. */
function matchMeal(attendees: Person[]): PlannedMeal {
  return { slot: 'dinar', attendees: [...attendees], primerId: null, segonId: MATCH_LUNCH_ID, single: 'segon' }
}

function pickFromExcluding(pool: Dish[], usedIds: string[], seed: number): Dish {
  const fresh = pool.filter((d) => !usedIds.includes(d.id))
  const candidates = fresh.length ? fresh : pool
  const idx = Math.floor(Math.abs(Math.sin(seed * 78.233) * 43758.5453) % 1 * candidates.length)
  return candidates[Math.min(idx, candidates.length - 1)]
}
