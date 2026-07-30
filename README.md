# Menú setmanal

Generador de menús setmanals segons la temporada de l'any, per a 1–4 persones,
amb anàlisi nutricional, llista de la compra i exportació per WhatsApp.

🌐 **En línia:** https://gunsalesss.github.io/menu-setmanal/

## Engegar

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # tests de la lògica
npm run build    # build estàtic a /dist (desplegable a qualsevol host)
```

## Com funciona

1. **Dates** — tries inici + nombre de dies. La temporada es calcula automàticament.
2. **Qui menja a casa** — per cada dia i àpat (dinar/sopar), marca 🏠 (casa) o 🚶 (fora) per a cadascú.
   Per defecte els caps de setmana es marquen com a fora.
3. **Generar** — omple cada àpat amb un **primer** i un **segon** des de la base de dades de
   la temporada, evitant repeticions i variant proteïnes. Cada generació és aleatòria.
4. **Anàlisi nutricional** — comprova regles basades en evidència (varietat de proteïnes, peix,
   llegums, cereals integrals, poca carn vermella, verdures...) i ofereix un botó per corregir-les.
5. **Llista de la compra** — agrega i escala els ingredients pels comensals. Marca el que ja
   tens i desapareixerà de l'exportació.
6. **Exportar** — quadres de text independents (menú i llista) per enganxar a WhatsApp,
   amb botó d'enviar directe i de compartir una **foto** de la graella.

Funcions addicionals:

- **🎲 Rebarrejar** o **✏️ triar** cada plat (primer o segon) individualment, i fer un àpat de **plat únic**.
- **1–4 persones**: afegir/treure comensals i **editar els noms** (botó del capçal); s'apliquen a tota l'app i es guarden.
- **Mode fosc** (per defecte) / clar amb un botó.
- Afegir articles fixos o puntuals a la llista de la compra (p. ex. aigua).
- **🔎 Consultar ingredients** de qualsevol plat de la base de dades.

Esmorzar, mig matí i berenar es deixen com a rutines fixes (no es generen).

### Regles per defecte (es poden canviar rebarrejant)

- Caps de setmana → tots els àpats fora.
- Dilluns → *mongeta i pastanaga al vapor* + *salmó a la planxa*.
- Divendres → *hummus amb pastanaga* + *smash burger*.
- Diumenge → *caldo* (tardor/hivern) o *gaspatxo* (primavera/estiu) + *pinya*.

L'exportació marca `_Fora_` quan tothom menja fora i `_<Nom> fora_` quan només en falta algú.

## La base de dades (el que editaràs tu)

Tot el contingut viu en fitxers JSON, separat del codi:

- `src/data/dishes.json` — els plats: nom, temporades, àpats, racions base, etiquetes i ingredients.
- `src/data/seasons.json` — rangs de dates → temporada.

Per afegir un plat, copia un bloc existent a `dishes.json` i edita'l. Els camps:

| camp | què és |
|------|--------|
| `seasons` | una o més de: `primavera`, `estiu`, `tardor`, `hivern` (totes per a plats de tot l'any) |
| `slots` | `dinar`, `sopar` |
| `course` | `primer` (entrant) i/o `segon` (plat principal). Cada àpat es genera amb un primer + un segon |
| `servingsBase` | per quantes racions són les quantitats d'ingredients |
| `tags` | per variar (`peix`, `carn`, `llegum`, `crema`, `amanida`...) |
| `ingredients[].scalable` | `false` = no es multiplica pels comensals (sal, oli) |

## Arquitectura

```
src/data/      → base de dades editable (JSON)
src/core/      → lògica pura en TypeScript (sense React): season, generate, nutrition, grocery, export
src/components → UI React
src/store.ts   → estat (Zustand)
```

La lògica de `core/` no depèn de React: és testejable i es podria moure a un backend o app mòbil.

## Desplegar

L'app ja està publicada a **GitHub Pages**: https://gunsalesss.github.io/menu-setmanal/

El workflow `.github/workflows/deploy.yml` reconstrueix i publica automàticament a cada
`push` a `main` (Pages amb *Source: GitHub Actions*).

Com que és una app estàtica (`npm run build` → `dist/`), també es pot penjar a qualsevol
altre host — p. ex. arrossegant `dist/` a [app.netlify.com/drop](https://app.netlify.com/drop)
(hi ha un `netlify.toml` preparat).

## Pendents / idees

- Completar la base de dades amb la resta de receptes (els `.docx` originals tenen fotos, no text).
- Mode "llista" alternatiu i impressió.
- Guardar menús generats / historial.
