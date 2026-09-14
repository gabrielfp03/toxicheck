# Toxicheck

PWA de consumo consciente. Escaneas un alimento y obtienes una nota de **0 a 10**
con el desglose completo de por qué. Gratis, ilimitado, sin cuentas y sin
servidor que pagar.

```
nota = 10 · (aditivos/10)^0,50 · (nutrición/10)^0,35 · (procesamiento/10)^0,15
```

---

## Índice

1. [Arquitectura y por qué cuesta 0 €](#1-arquitectura)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [El algoritmo](#3-el-algoritmo)
4. [Puesta en marcha paso a paso](#4-puesta-en-marcha-paso-a-paso)
5. [Despliegue en Vercel](#5-despliegue)
6. [Cómo se combinan los bloques](#6-cómo-se-combinan-los-bloques)
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
toxicheck/
├── public/
│   ├── icons/                       # iconos PWA (sustitúyelos por los tuyos)
│   └── sw.js                        # service worker escrito a mano (~90 líneas)
├── src/
│   ├── app/
│   │   ├── layout.tsx               # shell, metadatos PWA, script de tema
│   │   ├── globals.css              # Tailwind v4 + tokens de color
│   │   ├── manifest.ts              # manifiesto PWA tipado
│   │   ├── page.tsx                 # inicio + entrada manual de código
│   │   ├── scan/page.tsx            # escáner de códigos de barras
│   │   ├── ocr/page.tsx             # análisis de etiqueta por foto
│   │   ├── product/page.tsx         # ficha: /product?code=XXXX  (estática)
│   │   └── history/page.tsx         # historial en rejilla con fotos
│   ├── components/
│   │   ├── BarcodeScanner.tsx       # cámara + decodificación
│   │   ├── OcrScanner.tsx           # Tesseract.js con carga diferida
│   │   ├── ScoreGauge.tsx           # medidor circular en SVG puro
│   │   ├── ScoreBreakdown.tsx       # los tres bloques y sus motivos
│   │   ├── ProductView.tsx          # composición de la ficha
│   │   ├── AppHeader.tsx            # barra superior de marca
│   │   ├── ThemeToggle.tsx          # claro / oscuro / sistema
│   │   ├── BottomNav.tsx            # pestañas inferiores
│   │   ├── ScanFab.tsx              # botón flotante de escaneo
│   │   ├── icons.tsx                # iconos SVG en línea
│   │   └── ServiceWorkerRegister.tsx
│   ├── data/
│   │   └── additives.json           # 122 números E con riesgo y descripción
│   ├── hooks/
│   │   ├── useProductScore.ts       # fetch + cálculo + historial
│   │   └── useHistory.ts            # useSyncExternalStore sobre localStorage
│   ├── lib/
│   │   ├── openfoodfacts.ts         # cliente + normalización + validación EAN
│   │   ├── openfoodfacts.test.ts
│   │   ├── theme.ts                 # store de tema (sin React)
│   │   └── storage.ts               # historial observable
│   ├── types/
│   │   ├── product.ts               # capa cruda (OFF) + capa normalizada
│   │   └── score.ts                 # tipos del resultado
│   └── utils/
│       ├── calculator.ts            # ★ EL ALGORITMO
│       ├── calculator.test.ts       # 44 tests
│       ├── additives.ts             # normalización de códigos E y búsqueda
│       ├── nutrition.ts             # Nutri-Score 2017 recalculado
│       └── nova.ts                  # escala NOVA
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

### Bloque 1 · Aditivos y toxicidad (50 %)

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

### Bloque 2 · Calidad nutricional (35 %)

Nutri-Score (algoritmo general 2017, con la tabla alternativa de bebidas)
**recalculado por nosotros**, no copiado de la letra que trae Open Food Facts.
La razón es que necesitamos el desglose: "el azúcar te ha costado 1,2 puntos"
en vez de una letra opaca. Después se mapea linealmente de `[-15, 40]` a
`[10, 0]`.

### Bloque 3 · Nivel de procesamiento (15 %)

| NOVA | Subnota |
|---|---|
| 1 · sin procesar | 10 |
| 2 · ingrediente culinario | 7,5 |
| 3 · procesado | 5 |
| 4 · ultraprocesado | 0 |
| *sin dato* | *el apartado se excluye* |

**Sin grupo NOVA, cero efecto.** Si Open Food Facts no clasifica el producto,
el apartado no se evalúa: su 15 % se reparte entre aditivos y nutrición y la
nota sale exactamente igual que si el apartado no existiera. Hubo una
heurística que lo adivinaba a partir de los aditivos; se retiró porque
adivinar sólo podía penalizar. Un dato que no tenemos nunca cuenta como un
dato malo.

### Bandas de color

| Banda | Nota | Etiqueta |
|---|---|---|
| 🔴 Rojo | 0 – 4,9 | Malo |
| 🟠 Naranja | 5,0 – 7,5 | Mediocre |
| 🟢 Verde | 7,6 – 8,9 | Bueno |
| 🟢 Verde | 9,0 – 10 | Excelente |

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

result.score;              // 4.7
result.color;              // "red"
result.label;              // "Malo"
result.confidence;         // "high"
result.reasons[0];         // { label: "Azúcares: 56.3 g/100 g", impact: -0.9, ... }
result.blocks[2].subScore; // 0  (NOVA 4)
```

---

## 4. Puesta en marcha paso a paso

### Paso 0 · Requisitos

Node 20 o superior. Comprueba con `node -v`.

### Paso 1 · Instalar y arrancar

```bash
cd toxicheck
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
npm test            # 56 tests del algoritmo
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

## 6. Cómo se combinan los bloques

Los tres bloques se combinan con una **media geométrica ponderada**, no con una
suma:

```
nota = 10 · Π (máx(subNota_i, 1) / 10) ^ peso_i
```

**Por qué no una suma ponderada.** El bloque de aditivos pesa el 50 % y un
producto sin números E saca un 10 en él, así que la media ponderada le regala
**5 puntos fijos** pase lo que pase. Como la banda roja acaba justo en 5,0, un
ultraprocesado a base de azúcar y grasa de palma pero sin aditivos
problemáticos —una crema de cacao, por ejemplo— **jamás podría salir en rojo**,
ni con nutrición 0 y NOVA 4. La banda roja se volvería inalcanzable para toda
una categoría de productos.

La media geométrica elimina ese suelo: un apartado muy malo arrastra la nota
entera en lugar de compensarse. El `máx(subNota, 1)` es un suelo blando por
bloque para que un único 0 no anule el resultado.

Comparativa con productos reales:

| Producto | geométrica | lineal |
|---|---|---|
| Agua mineral | 10,0 🟢 | 10,0 |
| Lentejas cocidas | 8,4 🟢 | 8,6 |
| Galletas sin dato NOVA | 6,7 🟠 | 7,5 |
| Nutella | **4,7 🔴** | 6,1 🟠 |
| Refresco de cola | **4,7 🔴** | 5,3 🟠 |
| Salchichas cocidas | 2,4 🔴 | 2,4 |

Para volver al comportamiento lineal, cambia `DEFAULT_AGGREGATION` en
`utils/calculator.ts`, o pásalo por llamada:

```ts
calculateScore(product, { aggregation: "linear" });
```

Ambos comportamientos están cubiertos por tests.

---

## 6 bis. Temas

Tres estados, no dos: claro, oscuro y **sistema**. La preferencia se guarda en
`localStorage` y se aplica con un atributo `data-theme` en el elemento raíz;
`"system"` borra el atributo para que mande `prefers-color-scheme`.

Un script en línea dentro del `<head>` (`THEME_INIT_SCRIPT` en `lib/theme.ts`)
lo aplica **antes del primer pintado**. Sin él, abrir la app con el tema oscuro
guardado produce un fotograma en blanco que en móvil se ve muchísimo.

Todos los colores son tokens CSS declarados primero en `:root`. Ninguno se
define sólo dentro de un bloque de tema: esa es justo la forma de acabar con
texto de un tema sobre el fondo del otro.

---

## 7. Licencias y aviso legal

- Datos de producto: **Open Food Facts**, bajo licencia
  [ODbL](https://opendatacommons.org/licenses/odbl/). La atribución es
  obligatoria y ya está incluida en la ficha de producto.
- El diccionario `additives.json` es una **simplificación pedagógica**. La EFSA
  no publica "niveles de riesgo": publica IDA y dictámenes de seguridad.
  Revisa cada entrada antes de publicar.
- Toxicheck **no es consejo médico ni nutricional**. Es una herramienta de lectura
  de etiquetas.
