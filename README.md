# Google Fonts for Onshape

Onshape integrated app + custom FeatureScript pro vkládání textu z **Google Fonts** (~1900 rodin) do Part Studio skici jako **nativní, editovatelnou geometrii** (`scale`, `translateX/Y`, `rotation` parametry).

Sekundárně podporuje upload vlastních `.ttf`/`.otf` souborů.

## Architektura

- **Next.js + TypeScript** (deploy na Vercel) — iframe panel (`/panel`) + standalone preview (`/preview`) + OAuth backend + Onshape REST proxy
- **opentype.js** — text + font → cubic Bézier křivky → kompaktní JSON
- **FeatureScript** (`featurescript/textToSketch.fs`) — parsuje JSON, emit `skFitSpline` per cubic na zvolené rovině
- **Local Font Access API** (Chrome/Edge) + fallback upload `.ttf`/`.otf` + **Google Fonts** (volitelně, vyžaduje API key)
- **Vercel KV** pro OAuth tokeny (in-memory fallback pro dev)

## Lokální dev

```bash
pnpm install
pnpm dev
# Standalone preview (nepotřebuje žádný setup): http://localhost:3000/preview
```

`/preview` umožňuje testovat text→curves pipeline bez Onshape — vyber font, napiš text, vidíš SVG, můžeš stáhnout fixture JSON.

## Manuální setup pro plnou funkčnost (jednorázové kroky)

### 1. Publikace FeatureScript Feature Studia

1. V Onshape vytvoř **nový dokument** (bude veřejný — neukládej v něm IP).
2. V dokumentu vytvoř **Feature Studio** (`+` → `Create Feature Studio`).
3. Zkopíruj obsah [`featurescript/textToSketch.fs`](featurescript/textToSketch.fs) do FS notebooku. Uprav `FeatureScript 2570;` a `version : "2570.0"` na aktuální FS verzi (vlevo v notebooku jde najít `Notices` → number).
4. Klikni **`Commit`** (nahoru vpravo) — FS se zkompiluje.
5. **Cut version**: `Version 1` (icon hodinek vlevo). Verze musí být cut, ne workspace, protože reference musí být stabilní.
6. Změň document **Sharing → Make public**.
7. Z URL si vyčti tyto tři IDčka (vzor `/documents/<docId>/v/<versionId>/e/<elementId>`):
   - `ONSHAPE_FS_DOCUMENT_ID`
   - `ONSHAPE_FS_VERSION_ID`
   - `ONSHAPE_FS_ELEMENT_ID`

### 2. Manuální test FS feature (Fáze B verifikace)

1. V jiném dokumentu vytvoř **Part Studio**.
2. `Insert → Custom Feature → ⊕ Add custom features → ⊕ Import...` → vlož URL publikovaného dokumentu, vyber `Google Fonts to Sketch`.
3. Klikni na tlačítko `Google Fonts to Sketch` v paletě features.
4. V dialogu vlož do `Curve data (JSON)` obsah některého z [`fixtures/`](fixtures/) souborů (např. `arial-O.json`).
5. Vyber sketch plane (např. `Top`) a klikni zelený check.
6. **Co ověřit:**
   - Glyf se renderuje (správný tvar, Y nahoru).
   - Letter "O", "A", "B" mají vnitřní díry rozpoznané jako negativní oblasti (klikni `Extrude` → sketch regions s děrami).
   - Změna `Em-height` z 10 mm na 50 mm → text se proporčně zvětší.
   - Změna `Sketch plane` na jinou rovinu → text se přesune.

### 3. Registrace OAuth aplikace v Onshape Dev Portalu

1. Otevři `https://cad.onshape.com/appstore/dev-portal/oauthApps` → **Create new OAuth application**.
2. **Redirect URLs**: `https://<tvoje-vercel-domena>/api/oauth/callback` (pro lokální dev můžeš dočasně přidat `http://localhost:3000/api/oauth/callback`).
3. **OAuth scopes**: `OAuth2Read OAuth2Write`.
4. Zkopíruj **Client ID** a **Client secret** do `.env` (viz `.env.example`).
5. V tabu **Extensions** → **Add extension**:
   - Type: `Element Right Panel`
   - Context: `Part Studio`
   - Action URL: `https://<tvoje-vercel-domena>/panel`
   - Name: cokoliv (např. "Google Fonts to Sketch")

### 4. (Volitelné) Google Fonts API key

Pokud chceš v UI vybírat z ~1500 Google Fonts:
1. Otevři https://developers.google.com/fonts/docs/developer_api → **Get a Key**.
2. V Google Cloud Console aktivuj **Web Fonts Developer API** pro daný projekt.
3. Zkopíruj API key do `.env.local` jako `GOOGLE_FONTS_API_KEY`.

Backend stáhne přímo `.ttf` z `fonts.gstatic.com` (žádný WOFF2 decoder potřeba) a kešne metadata na 24 h. Bez API klíče je Google Fonts sekce v UI skrytá.

### 5. Env vars

Zkopíruj `.env.example` do `.env.local` a vyplň hodnoty:

```bash
cp .env.example .env.local
openssl rand -hex 32   # SESSION_SECRET
```

### 6. Deploy na Vercel

```bash
pnpm dlx vercel link
pnpm dlx vercel env add ONSHAPE_CLIENT_ID
# ... opakuj pro všechny ONSHAPE_* a SESSION_SECRET
pnpm dlx vercel kv add   # zaregistruje KV store + nastaví KV_* env vars
pnpm dlx vercel deploy --prod
```

Po deployi se vrať do Onshape Dev Portalu a aktualizuj redirect URI + extension Action URL na production doménu.

## Použití v Onshape

1. Otevři Part Studio.
2. Klikni na ikonu aplikace v pravém panelu (objevila se po registraci extension).
3. **Přihlásit přes OAuth** → schvalit přístup → popup se sám zavře.
4. Vyber font (nahraj `.ttf`/`.otf` nebo načti systémový), napiš text, nastav em-height.
5. Klikni **Vložit do Part Studia**.
6. V Onshape se objeví feature `Text "..."` v error stavu (chybí rovina) — otevři její dialog a vyber rovinu, dej check.

## Editovatelnost

Po vložení můžeš v Onshape:
- **Změnit em-height** — `scale` parametr; geometrie se přepočítá.
- **Změnit sketch plane** — text se přemístí.
- **Změnit text / font** — to potřebuje nové vložení z panelu (feature drží jen vygenerovanou geometrii, ne původní text + font).

## Struktura projektu

```
src/
  app/
    preview/page.tsx          # standalone test bez Onshape
    panel/page.tsx            # iframe panel uvnitř Onshape
    api/
      oauth/{start,callback,status}/route.ts
      feature/add/route.ts
      google-fonts/{list,file}/route.ts
  lib/
    textToCurves.ts           # opentype → cubic Bézier JSON
    onshape.ts                # REST klient + add-feature body
    googleFonts.ts            # Google Fonts Dev API klient + cache
    session.ts                # iron-session
    tokenStore.ts             # Vercel KV / in-memory
    env.ts                    # zod-validated env config
featurescript/
  textToSketch.fs             # FS feature publikovaná v Onshape
fixtures/                     # fixture JSONy pro manuální FS test
scripts/
  generate-fixtures.ts        # produkuje fixtures z lokálních fontů
```

## Známá omezení / dluhy

- **Sketch plane picker**: feature se vloží s prázdnou query, Onshape ji otevře v error stavu s dialogem — uživatel vybere plane nativně. Lepší UX (preselect z graphics area přes `SELECTION` postMessage) je v1.1.
- **Velký text**: payload nad ~80 KB zpomalí Onshape regen. Panel zobrazí warning. Pro >200 znaků v komplexních fontech zvaž splittění do více feature instancí (v1.1).
- **Font fallback**: Local Font Access API jen Chrome/Edge. Safari/Firefox → upload `.ttf`/`.otf`.
- ~~**Nestandardní OTF fonty**~~ — fixnuto v 5cfcde5: opentype.js u CFF/OTF fontů často neemituje `Z`, my teď zavíráme kontury implicitně na další `M` nebo na konci streamu.
- **Namespace formát** v add-feature requestu (`d::v::e`) je nedokumentovaný. Pokud první POST vrátí 400, ručně přidej feature v Onshape UI a `GET /features` vyplivne správný namespace — uprav `lib/onshape.ts`.
