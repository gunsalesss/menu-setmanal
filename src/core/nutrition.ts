import type { Course, Dish, Slot, Tag, WeeklyMenu } from './types'
import { dishById, poolFor } from './dishes'

export type RuleStatus = 'ok' | 'warn'

export interface RuleResult {
  id: string
  label: string
  status: RuleStatus
  detail: string
}

interface Meal {
  dishes: Dish[] // both courses that are actually eaten
  main?: Dish // the "segon" (protein) dish
}

/** Gather the eaten meals (skipping the ones where both are out). */
function collect(menu: WeeklyMenu): { meals: Meal[]; all: Dish[]; mains: Dish[] } {
  const meals: Meal[] = []
  for (const day of menu.days) {
    for (const m of [day.dinar, day.sopar]) {
      if (m.attendees.length === 0) continue
      const primer = m.primerId ? dishById(m.primerId) : undefined
      const main = m.segonId ? dishById(m.segonId) : undefined
      meals.push({ dishes: [primer, main].filter(Boolean) as Dish[], main })
    }
  }
  const all = meals.flatMap((m) => m.dishes)
  const mains = meals.map((m) => m.main).filter(Boolean) as Dish[]
  return { meals, all, mains }
}

const VEG_TAGS: Tag[] = ['verdura', 'amanida', 'crema']
const hasTag = (d: Dish, t: Tag) => d.tags.includes(t)
const hasVeg = (d: Dish) => d.tags.some((t) => VEG_TAGS.includes(t))
const hasCarb = (d: Dish) => d.ingredients.some((i) => i.category === 'llegums-cereals')
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

/** Evaluate a generated menu against a few basic nutritional rules. */
export function checkNutrition(menu: WeeklyMenu): RuleResult[] {
  const { meals, all, mains } = collect(menu)
  const results: RuleResult[] = []

  if (meals.length === 0) {
    return [{ id: 'empty', label: 'Sense àpats', status: 'ok', detail: 'Cap àpat a casa aquesta setmana.' }]
  }

  // 1. Unique dishes across the week.
  const counts = new Map<string, { name: string; n: number }>()
  for (const d of all) {
    const e = counts.get(d.id) ?? { name: d.name, n: 0 }
    e.n += 1
    counts.set(d.id, e)
  }
  const dups = [...counts.values()].filter((e) => e.n > 1)
  results.push({
    id: 'unique',
    label: 'Plats únics a la setmana',
    status: dups.length ? 'warn' : 'ok',
    detail: dups.length
      ? `Repetits: ${dups.map((d) => `${d.name} (×${d.n})`).join(', ')}`
      : 'Cap plat repetit.',
  })

  // 2. Protein balance — no single protein type should dominate the mains.
  const proteins: { tag: Tag; label: string }[] = [
    { tag: 'peix', label: 'peix' },
    { tag: 'carn', label: 'carn' },
    { tag: 'ou', label: 'ou' },
  ]
  const protCounts = proteins.map((p) => ({ ...p, n: mains.filter((d) => hasTag(d, p.tag)).length }))
  const totalProt = protCounts.reduce((s, p) => s + p.n, 0)
  const dominant = protCounts.find((p) => totalProt >= 3 && p.n / totalProt > 0.5)
  results.push({
    id: 'protein-balance',
    label: 'Equilibri de proteïnes',
    status: dominant ? 'warn' : 'ok',
    detail: protCounts.map((p) => `${p.label}: ${p.n}`).join(' · ') +
      (dominant ? ` — massa ${dominant.label} (${pct(dominant.n, totalProt)}%)` : ''),
  })

  // 3. Enough fish — fish should be at least ~30% of the main dishes.
  const fish = mains.filter((d) => hasTag(d, 'peix')).length
  results.push({
    id: 'fish',
    label: 'Peix suficient',
    status: mains.length && fish / mains.length >= 0.3 ? 'ok' : 'warn',
    detail: `${fish} de ${mains.length} plats principals (${pct(fish, mains.length)}%). Recomanat ≥ 30%.`,
  })

  // 4. Carbohydrate balance — whole-grain/legume carbs present, but not every meal.
  const carbMeals = meals.filter((m) => m.dishes.some(hasCarb)).length
  const carbShare = carbMeals / meals.length
  const carbOk = carbShare >= 0.15 && carbShare <= 0.66
  results.push({
    id: 'carbs',
    label: 'Equilibri d\'hidrats de carboni',
    status: carbOk ? 'ok' : 'warn',
    detail:
      `${carbMeals} de ${meals.length} àpats amb hidrats integrals (${pct(carbMeals, meals.length)}%). ` +
      (carbShare < 0.15 ? 'Massa pocs.' : carbShare > 0.66 ? 'Massa.' : 'Recomanat 15–66%.'),
  })

  // 5. Vegetables in (almost) every meal.
  const vegMeals = meals.filter((m) => m.dishes.some(hasVeg)).length
  results.push({
    id: 'veggies',
    label: 'Verdura a cada àpat',
    status: vegMeals / meals.length >= 0.8 ? 'ok' : 'warn',
    detail: `${vegMeals} de ${meals.length} àpats amb verdura/amanida (${pct(vegMeals, meals.length)}%). Recomanat ≥ 80%.`,
  })

  return results
}

// ── Auto-fix ────────────────────────────────────────────────────────────────
// Each fixer makes the smallest changes it can to turn a failing rule green,
// swapping individual dishes (respecting season/slot/course) and avoiding
// duplicates. The UI re-runs checkNutrition after a fix so the alerts refresh.

const SLOTS: Slot[] = ['dinar', 'sopar']
interface Loc { day: number; slot: Slot; course: Course }
const field = (c: Course) => (c === 'primer' ? 'primerId' : 'segonId')

function eatenLocs(menu: WeeklyMenu): Loc[] {
  const out: Loc[] = []
  menu.days.forEach((d, i) => {
    for (const slot of SLOTS) {
      if (d[slot].attendees.length === 0) continue
      out.push({ day: i, slot, course: 'primer' }, { day: i, slot, course: 'segon' })
    }
  })
  return out
}

const idAt = (menu: WeeklyMenu, l: Loc) => menu.days[l.day][l.slot][field(l.course)]
const dishAt = (menu: WeeklyMenu, l: Loc) => { const id = idAt(menu, l); return id ? dishById(id) : undefined }

function withId(menu: WeeklyMenu, l: Loc, id: string): WeeklyMenu {
  const days = menu.days.map((d, i) =>
    i === l.day ? { ...d, [l.slot]: { ...d[l.slot], [field(l.course)]: id } } : d,
  )
  return { ...menu, days }
}

const chosenIds = (menu: WeeklyMenu) =>
  eatenLocs(menu).map((l) => idAt(menu, l)).filter(Boolean) as string[]

/** Pick a replacement for a location matching `pred`, preferring non-duplicates. */
function pickReplacement(menu: WeeklyMenu, l: Loc, pred: (d: Dish) => boolean): string | null {
  const used = new Set(chosenIds(menu))
  const current = idAt(menu, l)
  const pool = poolFor(menu.season, l.slot, l.course).filter((d) => d.id !== current && pred(d))
  const fresh = pool.filter((d) => !used.has(d.id))
  const cands = fresh.length ? fresh : pool
  if (!cands.length) return null
  return cands[Math.floor(Math.random() * cands.length)].id
}

const ruleStatus = (menu: WeeklyMenu, id: string) =>
  checkNutrition(menu).find((r) => r.id === id)?.status

/** Resolve a specific nutritional alert by swapping dishes. Returns a new menu. */
export function fixRule(menu: WeeklyMenu, ruleId: string): WeeklyMenu {
  switch (ruleId) {
    case 'unique': return fixUnique(menu)
    case 'protein-balance': return fixProtein(menu)
    case 'fish': return fixFish(menu)
    case 'carbs': return fixCarbs(menu)
    case 'veggies': return fixVeggies(menu)
    default: return menu
  }
}

function fixUnique(menu: WeeklyMenu): WeeklyMenu {
  const seen = new Set<string>()
  let m = menu
  for (const l of eatenLocs(m)) {
    const id = idAt(m, l)
    if (!id) continue
    if (seen.has(id)) {
      const repl = pickReplacement(m, l, () => true)
      seen.add(repl ?? id)
      if (repl) m = withId(m, l, repl)
    } else {
      seen.add(id)
    }
  }
  return m
}

function fixFish(menu: WeeklyMenu): WeeklyMenu {
  let m = menu
  for (let i = 0; i < 12 && ruleStatus(m, 'fish') === 'warn'; i++) {
    const target = eatenLocs(m).find((l) => {
      const d = dishAt(m, l)
      return l.course === 'segon' && d && !d.tags.includes('peix')
    })
    if (!target) break
    const repl = pickReplacement(m, target, (d) => d.tags.includes('peix'))
    if (!repl) break
    m = withId(m, target, repl)
  }
  return m
}

function fixProtein(menu: WeeklyMenu): WeeklyMenu {
  let m = menu
  const tags: Tag[] = ['peix', 'carn', 'ou']
  for (let i = 0; i < 14 && ruleStatus(m, 'protein-balance') === 'warn'; i++) {
    const mains = eatenLocs(m)
      .filter((l) => l.course === 'segon')
      .map((l) => ({ l, d: dishAt(m, l) }))
      .filter((x) => x.d) as { l: Loc; d: Dish }[]
    const total = mains.length
    const dom = tags
      .map((t) => ({ t, n: mains.filter((x) => x.d.tags.includes(t)).length }))
      .find((c) => total >= 3 && c.n / total > 0.5)
    if (!dom) break
    const target = mains.find((x) => x.d.tags.includes(dom.t))
    if (!target) break
    const repl = pickReplacement(m, target.l, (d) => !d.tags.includes(dom.t))
    if (!repl) break
    m = withId(m, target.l, repl)
  }
  return m
}

function fixVeggies(menu: WeeklyMenu): WeeklyMenu {
  let m = menu
  for (let i = 0; i < 16 && ruleStatus(m, 'veggies') === 'warn'; i++) {
    // Find an eaten meal whose dishes lack vegetables.
    const dayLoc = eatenLocs(m).find((l) => {
      const day = m.days[l.day]
      const dishes = [day[l.slot].primerId, day[l.slot].segonId]
        .map((id) => (id ? dishById(id) : undefined)).filter(Boolean) as Dish[]
      return !dishes.some(hasVeg)
    })
    if (!dayLoc) break
    const loc: Loc = { day: dayLoc.day, slot: dayLoc.slot, course: 'primer' }
    const repl = pickReplacement(m, loc, hasVeg)
    if (!repl) break
    m = withId(m, loc, repl)
  }
  return m
}

function fixCarbs(menu: WeeklyMenu): WeeklyMenu {
  let m = menu
  for (let i = 0; i < 16 && ruleStatus(m, 'carbs') === 'warn'; i++) {
    const { meals } = collect(m)
    const carbMeals = meals.filter((mm) => mm.dishes.some(hasCarb)).length
    const tooFew = carbMeals / meals.length < 0.15
    // Pick a meal to adjust and a course to swap.
    const mealLoc = eatenLocs(m).find((l) => {
      const day = m.days[l.day]
      const dishes = [day[l.slot].primerId, day[l.slot].segonId]
        .map((id) => (id ? dishById(id) : undefined)).filter(Boolean) as Dish[]
      const mealHasCarb = dishes.some(hasCarb)
      return tooFew ? !mealHasCarb : mealHasCarb
    })
    if (!mealLoc) break
    let changed = false
    for (const course of ['primer', 'segon'] as Course[]) {
      const loc: Loc = { day: mealLoc.day, slot: mealLoc.slot, course }
      if (!tooFew) {
        const d = dishAt(m, loc)
        if (!d || !hasCarb(d)) continue
      }
      const repl = pickReplacement(m, loc, (d) => (tooFew ? hasCarb(d) : !hasCarb(d)))
      if (repl) { m = withId(m, loc, repl); changed = true; break }
    }
    if (!changed) break
  }
  return m
}
