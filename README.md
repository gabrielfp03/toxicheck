# Toxify

PWA de consumo consciente. Escaneas un alimento y obtienes una nota de **0 a 10**
con el desglose completo de por qué. Gratis, ilimitado, sin cuentas y sin
servidor que pagar.

```
nota = 0,40 · aditivos  +  0,40 · nutrición  +  0,20 · procesamiento
```

---

## Índice

1. [Arquitectura y por qué cuesta 0 €](#1-arquitectura)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [El algoritmo](#3-el-algoritmo)
4. [Puesta en marcha paso a paso](#4-puesta-en-marcha-paso-a-paso)
5. [Despliegue en Vercel](#5-despliegue)
6. [Limitación conocida del modelo](#6-limitación-conocida-del-modelo)
7. [Hoja de ruta](#7-hoja-de-ruta)
8. [Licencias y aviso legal](#8-licencias-y-aviso-legal)

---

## 1. Arquitectura

La regla de oro: **el servidor no calcula nada**.

| Pieza | Dónde se ejecuta | Coste |
|---|---|---|
| Escáner de códigos de barras | Navegador (`BarcodeDetector` nativo o ZXing) | 0 |
| Consulta de producto | Navegador → Open Food Facts (CORS directo) | 0 |
| Diccionario de aditivos | Bundle JS (JSON estático) | 0 |
| Cálculo de la nota | Navegador (función pura, < 1 ms) | 0 |
| OCR de etiquetas | Navegador (Tesseract.js en Web Worker) | 0 |
| Historial | `localStorage` del usuario | 0 |
| Hosting | Vercel — **las 7 rutas son estáticas** | 0 |

Consecuencia práctica: no hay API routes, no hay funciones serverless, no hay
base de datos y no hay límite de escaneos por usuario. La única cuota que
existe es la del hosting estático, que en Vercel Hobby es de sobra.

> **Ojo con las rutas dinámicas.** La ficha del producto es `/product?code=123`
> y no `/product/[barcode]`. Una ruta dinámica obliga a Next a marcarla como
> `ƒ (Dynamic)` y Vercel levanta una función en cada visita aunque el
> componente sea de cliente. Con el parámetro de consulta la página es HTML
> estático servido desde la CDN. Compruébalo en la salida de `npm run build`:
> todas las rutas deben llevar `○ (Static)`.

---

## 2. Estructura del proyecto

```
toxify/
├── public/
│   ├── icons/                       # iconos PWA (sustitúyelos por los tuyos)
│   └── sw.js                        # service worker escrito a mano (~90 líneas)
├── src/
│   ├── app/
│   │   ├── layout.tsx               # shell, metadatos PWA, nav inferior
│   │   ├── globals.css              # Tailwind v4 + tokens de color
│   │   ├── manifest.ts              # manifiesto PWA tipado
│   │   ├── page.tsx                 # inicio + entrada manual de código
│   │   ├── scan/page.tsx            # escáner de códigos de barras
│   │   ├── ocr/page.tsx             # análisis de etiqueta por foto
│   │   ├── product/page.tsx         # ficha: /product?code=XXXX  (estática)
│   │   └── history/page.tsx         # historial local
│   ├── components/
│   │   ├── BarcodeScanner.tsx       # cámara + decodificación
│   │   ├── OcrScanner.tsx           # Tesseract.js con carga diferida
│   │   ├── ScoreGauge.tsx           # medidor circular en SVG puro
│   │   ├── ScoreBreakdown.tsx       # los tres bloques y sus motivos
│   │   ├── ProductView.tsx          # composición de la ficha
│   │   ├── BottomNav.tsx
│   │   └── ServiceWorkerRegister.tsx
│   ├── data/
│   │   └── additives.json           # 122 números E con riesgo y descripción
│   ├── hooks/
│   │   ├── useProductScore.ts       # fetch + cálculo + historial
│   │   └── useHistory.ts            # useSyncExternalStore sobre localStorage
│   ├── lib/
│   │   ├── openfoodfacts.ts         # cliente + normalización + validación EAN
│   │   ├── openfoodfacts.test.ts
│   │   └── storage.ts               # historial observable
│   ├── types/
│   │   ├── product.ts               # capa cruda (OFF) + capa normalizada
│   │   └── score.ts                 # tipos del resultado
│   └── utils/
│       ├── calculator.ts            # ★ EL ALGORITMO
│       ├── calculator.test.ts       # 40 tests
│       ├── additives.ts             # normalización de códigos E y búsqueda
│       ├── nutrition.ts             # Nutri-Score 2017 recalculado
│       └── nova.ts                  # escala NOVA + heurística de respaldo
├── eslint.config.mjs
├── next.config.ts
├── postcss.config.mjs
├── vitest.config.mts
└── tsconfig.json
```

**Por qué esta forma.** Las dependencias van siempre en un sentido:
`app → components → hooks → lib → utils → types`. `utils/calculator.ts` no
importa nada de React ni de red, así que se puede testear sin mocks y, el día
que montes la app nativa, se copia tal cual.

---

## 3. El algoritmo

`calculateScore(product) → ScoreResult`. Función pura. Entra un `Product`
normalizado, sale la nota **y el argumento completo** que la justifica.

### Bloque 1 · Aditivos y toxicidad (40 %)

Parte de 10 y resta según el riesgo de cada número E, tomado de
`data/additives.json`:

| Riesgo | Penalización | Ejemplos |
|---|---|---|
| `none` | −0 | E330 ácido cítrico, E300 vitamina C |
| `low` | −0,5 | E202 sorbato potásico, E471 mono y diglicéridos |
| `moderate` | −1,5 | E102 tartrazina, E211 benzoato sódico, E951 aspartamo |
| `high` | −3 | E171 dióxido de titanio, E250 nitrito sódico, E320 BHA |

Más una penalización por **efecto cóctel**: a partir del sexto aditivo, −0,25
por cada uno hasta un máximo de −2. Un aditivo que no esté catalogado se trata
como `low`: prudencia sin alarmismo.

### Bloque 2 · Calidad nutricional (40 %)

Nutri-Score (algoritmo general 2017, con la tabla alternativa de bebidas)
**recalculado por nosotros**, no copiado de la letra que trae Open Food Facts.
La razón es que necesitamos el desglose: "el azúcar te ha costado 1,2 puntos"
en vez de una letra opaca. Después se mapea linealmente de `[-15, 40]` a
`[10, 0]`.

### Bloque 3 · Nivel de procesamiento (20 %)

| NOVA | Subnota | Coste en la nota final |
|---|---|---|
| 1 · sin procesar | 10 | 0 |
| 2 · ingrediente culinario | 7,5 | −0,5 |
| 3 · procesado | 5 | −1 |
| 4 · ultraprocesado | 0 | **−2** |

### Datos faltantes

Open Food Facts es colaborativo y muchos productos vienen incompletos. Un
bloque sin datos **no se puntúa con 0** (sería injusto): se excluye y los pesos
de los demás se renormalizan para seguir sumando 1. El resultado se marca con
`confidence: "medium" | "low"` y se listan los campos ausentes.

### Uso

```ts
import { fetchProductByBarcode } from "@/lib/openfoodfacts";
import { calculateScore } from "@/utils/calculator";

const product = await fetchProductByBarcode("3017620422003");
const result  = calculateScore(product);

result.score;              // 5.2
result.color;              // "yellow"
result.label;              // "Mediocre"
result.confidence;         // "high"
result.reasons[0];         // { label: "Azúcares: 56.3 g/100 g", impact: -1.02, ... }
result.blocks[2].subScore; // 0  (NOVA 4)
```

---

## 4. Puesta en marcha paso a paso

### Paso 0 · Requisitos

Node 20 o superior. Comprueba con `node -v`.

### Paso 1 · Instalar y arrancar

```bash
cd toxify
npm install
npm run dev
```

Abre `http://localhost:3000`. La entrada manual de código de barras ya
funciona: prueba con `3017620422003` (Nutella) o `5449000000996` (Coca-Cola).

> La cámara **no funcionará en `localhost` desde el móvil** porque
> `getUserMedia` exige HTTPS. Para probar el escáner en el teléfono, despliega
> en Vercel (paso 6) o usa un túnel HTTPS.

### Paso 2 · Verificar que todo está sano

```bash
npm run typecheck   # TypeScript estricto, sin errores
npm run lint        # ESLint 9, sin errores
npm test            # 48 tests del algoritmo
npm run build       # las 7 rutas deben salir como ○ (Static)
```

### Paso 3 · Ampliar el diccionario de aditivos

`src/data/additives.json` trae 122 entradas, las más frecuentes en el lineal
español. **Es una semilla: revisa cada clasificación contra el dictamen EFSA
vigente antes de publicar.** Añadir una entrada es esto:

```jsonc
"E385": {
  "code": "E385",
  "name": "EDTA cálcico disódico",
  "category": "estabilizante",     // colorante | conservante | antioxidante | ...
  "risk": "moderate",              // none | low | moderate | high
  "origin": "sintético",
  "description": "Quelante que puede interferir en la absorción de minerales.",
  "efsaAdi": "2,5 mg/kg de peso corporal al día",
  "flags": ["quelante"]
}
```

La clave del objeto y el campo `code` deben coincidir exactamente, en la forma
canónica `E` + dígitos + sufijo en minúscula (`E150d`, `E472e`).

### Paso 4 · Ajustar la severidad del modelo

Todo lo que controla la dureza de la nota está en dos sitios:

- `src/data/additives.json` → `penalties` (cuánto resta cada nivel de riesgo).
- `src/utils/calculator.ts` → `WEIGHTS`, `COCKTAIL` y `SCALE` (umbrales de
  color y etiqueta).

Cambia un número, ejecuta `npm test` y mira qué productos se mueven. Los tests
incluyen cinco productos reales (agua, lentejas, refresco de cola, crema de
cacao y salchichas) precisamente para que el calibrado sea una decisión
informada y no a ciegas.

Cuando cambies la fórmula, sube `ALGORITHM_VERSION` en `calculator.ts`: así se
invalidan las notas guardadas en el historial.

### Paso 5 · Sustituir los iconos

Los de `public/icons/` son marcadores de posición generados. Necesitas:
`icon-192.png`, `icon-512.png`, `icon-maskable-512.png` y
`apple-touch-icon.png` (180×180). El *maskable* debe llevar el logotipo dentro
del 80 % central para que Android no lo recorte.

### Paso 6 · Desplegar

Ver la sección siguiente.

---

## 5. Despliegue

```bash
npm i -g vercel
vercel
```

No hace falta ninguna variable de entorno: no hay secretos porque no hay
backend. Vercel detecta Next.js y sirve las 7 rutas desde la CDN.

**Alternativa 100 % estática.** Como ninguna ruta es dinámica, el proyecto se
puede exportar a HTML plano y alojar en cualquier sitio (Netlify, Cloudflare
Pages, GitHub Pages, un bucket S3):

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // `headers()` no está soportado con output: "export": configura las
  // cabeceras en tu hosting.
};
```

```bash
npm run build   # genera ./out
```

---

## 6. Limitación conocida del modelo

El modelo lineal 40/40/20 que define el producto tiene un **suelo
estructural de 4,0**.

El bloque de aditivos vale el 40 % y un producto sin aditivos saca un 10 en él,
así que aporta 4 puntos fijos pase lo que pase. Un ultraprocesado a base de
azúcar y grasa de palma pero sin números E problemáticos —una crema de cacao,
por ejemplo— **no puede bajar de 4,0 aunque tenga nutrición 0 y NOVA 4**. Es
decir: con esta fórmula nunca se le podrá poner la etiqueta "Malo".

Por eso `calculateScore` acepta una segunda forma de combinar los bloques:

```ts
calculateScore(product, { aggregation: "geometric" });
```

La media geométrica ponderada multiplica en lugar de sumar, así que un bloque
muy malo arrastra la nota entera. Con un suelo blando de 1 por bloque para que
un solo 0 no anule el resultado:

```
nota = 10 · Π (máx(subNota_i, 1) / 10) ^ peso_i
```

Comparativa con los productos de los tests:

| Producto | `linear` | `geometric` |
|---|---|---|
| Agua mineral | 10,0 | 10,0 |
| Lentejas cocidas | 8,3 | 8,0 |
| Refresco de cola | 4,8 | 4,2 |
| **Crema de cacao** | **5,2** | **3,9** |
| Salchichas cocidas | 2,4 | 2,3 |

El valor por defecto es `"linear"` porque es literalmente la especificación
acordada (y con ella "NOVA 4 = −2 puntos" se cumple al pie de la letra).
**La recomendación es cambiar el defecto a `"geometric"`** y ajustar después
los umbrales de `SCALE`, porque una crema de cacao con 56 g de azúcar por
100 g calificada de "Mediocre" es un error que el usuario va a notar antes que
cualquier otro. Ambos comportamientos están cubiertos por tests.

---

## 7. Hoja de ruta

- [ ] Cambiar la agregación por defecto a `geometric` y recalibrar `SCALE`.
- [ ] Revisar las 122 entradas de `additives.json` contra la EFSA y añadir
      `references` por entrada.
- [ ] Comparador de dos productos lado a lado.
- [ ] Alternativas mejores dentro de la misma categoría (usando
      `categories_tags` de Open Food Facts).
- [ ] Perfiles: sin gluten, sin lactosa, vegano, gota/purinas, fenilcetonuria.
      Los `flags` del diccionario ya están preparados para esto.
- [ ] OCR: reconocer aditivos escritos por su nombre, no sólo por su número E.
- [ ] Contribuir de vuelta a Open Food Facts desde la propia app.
- [ ] App nativa: `utils/` y `types/` son portables tal cual a React Native.

---

## 8. Licencias y aviso legal

- Datos de producto: **Open Food Facts**, bajo licencia
  [ODbL](https://opendatacommons.org/licenses/odbl/). La atribución es
  obligatoria y ya está incluida en la ficha de producto.
- El diccionario `additives.json` es una **simplificación pedagógica**. La EFSA
  no publica "niveles de riesgo": publica IDA y dictámenes de seguridad.
  Revisa cada entrada antes de publicar.
- Toxify **no es consejo médico ni nutricional**. Es una herramienta de lectura
  de etiquetas.
