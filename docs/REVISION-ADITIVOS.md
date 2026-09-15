# Cómo revisar el diccionario de aditivos

Este documento define **cómo se decide el nivel de riesgo de un aditivo** en
Toxicheck, para que la decisión sea reproducible por otra persona y no dependa
del criterio de quien escribió la entrada.

---

## 1. El problema de fondo

`risk: "high"` no es un dato. Es una conclusión.

Ningún organismo publica "niveles de riesgo" de aditivos:

- La **EFSA** publica dictámenes e **ingestas diarias admisibles** (IDA).
- La **IARC** publica clasificaciones de la **solidez de la evidencia** de que
  algo cause cáncer. No mide cuánto riesgo supone una ración.
- La **Comisión Europea** publica normas: autoriza, restringe o prohíbe.
- La **FDA** hace lo propio en Estados Unidos.

Toxicheck necesita un número para calcular, así que tiene que traducir todo eso
a cuatro niveles. Esa traducción es una decisión editorial, y por tanto debe
estar **escrita, ser pública y apoyarse en fuentes citadas**. De lo contrario
es una opinión disfrazada de dato.

De ahí las dos reglas del proyecto:

1. Cada entrada con riesgo relevante lleva un campo `evidence` con lo que dice
   cada fuente y su enlace.
2. Hay un test (`src/data/additives.test.ts`) que **falla si un aditivo está
   en riesgo alto sin ninguna fuente citada**, o si la fuente no viene de un
   dominio oficial. No es opcional: bloquea la integración continua.

---

## 2. La regla de clasificación

Se aplica de arriba abajo; gana el primer criterio que se cumpla.

### `high` — riesgo alto (−3 puntos)

Al menos uno de:

- **Prohibido como aditivo alimentario en la UE.** Ejemplo: E171, retirado por
  el Reglamento (UE) 2022/63.
- **La EFSA no ha podido establecer una IDA** por un problema de seguridad
  (no por falta de datos de exposición). Ejemplo: E171 de nuevo.
- **Prohibido o retirado en otra jurisdicción de referencia** (Estados Unidos,
  Reino Unido) por motivos de seguridad. Ejemplos: E123, E127.
- **Clasificación IARC de grupo 1 o 2A** que aplique al aditivo o al uso
  característico del aditivo. Ejemplo: los nitritos y nitratos, grupo 2A en
  condiciones de nitrosación endógena.
- **Uso restringido en la UE a un puñado de alimentos** por motivos
  toxicológicos, combinado con una IDA muy baja. Ejemplo: E123.

### `moderate` — riesgo moderado (−1,5 puntos)

Al menos uno de:

- **Clasificación IARC de grupo 2B** sin una prohibición que la acompañe.
  Ejemplo: E320.
- **Advertencia obligatoria en el etiquetado de la UE.** Ejemplo: los seis
  colorantes de Southampton (E102, E104, E110, E122, E124, E129).
- **IDA de grupo con exposición estimada cercana o por encima del límite en
  parte de la población.** Ejemplo: los fosfatos, IDA de grupo desde 2019.
- **La EFSA no ha podido concluir por falta de datos.** Ejemplo: E551.
- **Alérgeno de declaración obligatoria** con reacciones graves descritas.
  Ejemplo: los sulfitos.

### `low` — riesgo bajo (−0,5 puntos)

- Autorizado, con IDA holgada, pero con efectos menores documentados: efecto
  laxante, molestias digestivas, sensibilizaciones puntuales.
- O bien es un marcador claro de ultraprocesado sin problema toxicológico
  propio.
- **También los aditivos que no están en el diccionario**, por prudencia: no
  sabemos, no presumimos lo peor ni lo mejor.

### `none` — sin riesgo conocido (0 puntos)

- Autorizado, sin IDA numérica necesaria o con una IDA muy por encima de
  cualquier consumo realista, y sin señalamientos de ningún organismo.
- Típicamente sustancias que ya están en la dieta: ácido cítrico, vitamina C,
  lecitinas, pectinas.

---

## 3. Qué hacer, paso a paso

Para cada aditivo:

1. **Busca el dictamen de la EFSA.** Todos los aditivos autorizados antes de
   2009 están pasando por un programa de reevaluación. Empieza por
   `efsa.europa.eu` y el *EFSA Journal*. Anota el año y la IDA.
2. **Comprueba la IARC.** Sólo si hay una clasificación, y anota el volumen y
   el grupo. Ojo: la IARC clasifica *agentes*, y a veces el agente es el
   alimento (carne procesada), no el aditivo.
3. **Comprueba el estado normativo en la UE** en EUR-Lex o en el registro de
   aditivos de la Comisión: ¿autorizado, restringido, prohibido?
4. **Comprueba si hay divergencia con Estados Unidos.** Una prohibición en una
   jurisdicción y no en otra es información relevante para el usuario.
5. **Aplica la regla** de la sección 2 y añade la entrada a
   `scripts/revisar-aditivos.py`.
6. `python3 scripts/revisar-aditivos.py && npm test`

### Lo que no vale como fuente

El test rechaza cualquier dominio que no sea de un organismo oficial. Nada de
blogs de nutrición, agregadores de números E ni Wikipedia. La lista blanca
está en `src/data/additives.test.ts`.

---

## 4. Trampas que ya me he encontrado

**Una clasificación IARC antigua no gana a un dictamen EFSA reciente.** El
E320 (BHA) estaba clasificado como riesgo alto por su grupo 2B de la IARC, de
1986. Pero la reevaluación de la EFSA de 2011 fue favorable: subió la IDA de
0,5 a 1,0 mg/kg y descartó la genotoxicidad. Sostener "riesgo alto" con eso
encima de la mesa no se aguanta. Se bajó a moderado, y la entrada cita ambas
cosas para que el usuario juzgue.

**Peligro no es lo mismo que riesgo.** La IARC dice cuán sólida es la
evidencia de que algo pueda causar cáncer, no cuánto cáncer causa. La carne
procesada está en el grupo 1 igual que el tabaco, y eso no significa que sean
igual de peligrosos. Si la entrada no lo aclara, el usuario entiende otra cosa.

**El agente clasificado no siempre es el aditivo.** El grupo 1 es de la *carne
procesada*, no del nitrito sódico. Escribir "E250, grupo 1 de la IARC" sería
sencillamente falso. La entrada debe decir qué clasificó la IARC exactamente.

**Una advertencia de etiquetado no es el final de la historia.** Los
colorantes E104, E110 y E124 llevan la advertencia de hiperactividad del
Reglamento 1333/2008, pero además la UE les recortó los niveles máximos de uso
con el Reglamento 232/2012, precisamente porque la EFSA había rebajado sus IDA
y la ingesta estimada las superaba. Citar sólo la advertencia deja entender que
el problema de exposición sigue abierto cuando fue atendido.

**Una IDA baja no es señal de peligro por sí sola.** Significa que el margen
es estrecho, no que el aditivo sea tóxico a las dosis de uso. Sólo cuenta como
criterio combinada con una restricción de uso.

---

## 5. Estado

| | |
|---|---|
| Entradas en el diccionario | 122 |
| Revisadas contra fuentes primarias | 18 |
| Pendientes | 104 |
| De ellas, con penalización sin verificar | 32 moderados + 30 bajos |

Hechas: los ocho de riesgo alto, los seis colorantes de Southampton
(E102, E104, E110, E122, E124, E129), y los cuatro sulfitos E220, E221, E223,
E224 (comparten dictamen EFSA 2016/2022: IDA temporal de grupo retirada en
2022 por falta de datos suficientes, con MOE por debajo del umbral de
seguridad para consumidores altos).

**Pendiente de la tanda anterior:** E210, E211, E212 (benzoatos). Comparten
dictamen EFSA 2016 (14(3):4433), pero ese documento no se pudo abrir desde
este entorno — Wiley devuelve 403 a cualquier cliente automatizado y EUR-Lex
responde con un reto de bot de AWS WAF. Quedan en `moderate` sin evidencia
nueva hasta que alguien pueda abrir el dictamen con un navegador real.

**Siguiente tanda:** los fosfatos (E338 a E341, E450 a E452), que comparten la
IDA de grupo de la EFSA de 2019 y se resuelven casi de una vez.

Cuando termines una tanda, sube el mínimo del test de cobertura en
`src/data/additives.test.ts`.
