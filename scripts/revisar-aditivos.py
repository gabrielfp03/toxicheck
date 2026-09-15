#!/usr/bin/env python3
"""
Aplica una revisión documentada a entradas de `src/data/additives.json`.

Por qué un script y no editar el JSON a mano: el fichero tiene 122 entradas y
la revisión va a ser un proceso largo, hecho a ratos. Tocarlo a mano invita a
romper la estructura o a olvidarse de poner la fecha de revisión. Aquí las
revisiones se declaran como datos, el script las aplica y el test de
validación comprueba el resultado.

Uso:  python3 scripts/revisar-aditivos.py
"""

import json
import pathlib
import sys

RUTA = pathlib.Path(__file__).resolve().parent.parent / "src/data/additives.json"
FECHA = "2026-09-15"

# ---------------------------------------------------------------------------
#  Revisiones
# ---------------------------------------------------------------------------
#
#  Cada entrada sustituye los campos indicados y añade `evidence` +
#  `reviewedAt`. El nivel de riesgo se DERIVA de las evidencias según la regla
#  documentada en `docs/REVISION-ADITIVOS.md`; no se elige a ojo.

REVISIONES = {
    "E171": {
        "risk": "high",
        "description": (
            "En 2021 la EFSA concluyó que ya no puede considerarse seguro como "
            "aditivo alimentario: no se pudo descartar la genotoxicidad y no "
            "procedía fijar una ingesta diaria admisible. Prohibido en "
            "alimentos en la UE desde 2022."
        ),
        "flags": ["prohibido-ue", "genotoxicidad-no-descartada"],
        "efsaAdi": "No se ha podido establecer",
        "evidence": [
            {
                "body": "EFSA",
                "type": "dictamen",
                "year": 2021,
                "finding": "El dióxido de titanio ya no puede considerarse seguro como aditivo alimentario; no se puede descartar la genotoxicidad y no procede establecer una IDA.",
                "url": "https://www.efsa.europa.eu/en/news/titanium-dioxide-e171-no-longer-considered-safe-when-used-food-additive",
            },
            {
                "body": "Comisión Europea",
                "type": "norma",
                "year": 2022,
                "finding": "El Reglamento (UE) 2022/63 retira el E171 de la lista de aditivos autorizados en alimentos.",
                "url": "https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32022R0063",
            },
        ],
    },
    "E127": {
        "risk": "high",
        "description": (
            "Colorante rojo yodado. En la UE su uso está restringido a cerezas "
            "en conserva y confitadas. En enero de 2025 la FDA revocó su "
            "autorización en alimentos en Estados Unidos por la cláusula "
            "Delaney, al inducir cáncer en ratas macho."
        ),
        "flags": ["uso-restringido-ue", "retirado-eeuu-2025"],
        "evidence": [
            {
                "body": "FDA",
                "type": "norma",
                "year": 2025,
                "finding": "Revoca la autorización del FD&C Red No. 3 en alimentos (plazo de adaptación hasta enero de 2027) al amparo de la cláusula Delaney. La propia FDA señala que el mecanismo observado en ratas macho no se ha demostrado en humanos.",
                "url": "https://www.fda.gov/industry/color-additives/fdc-red-no-3",
            },
        ],
    },
    "E123": {
        "risk": "high",
        "description": (
            "Colorante azoico rojo. La EFSA rebajó su ingesta diaria admisible "
            "más de cincuenta veces en 2010, hasta 0,015 mg/kg de peso "
            "corporal. En la UE sólo se autoriza en unos pocos usos y en "
            "Estados Unidos está prohibido desde 1976."
        ),
        "flags": ["prohibido-eeuu", "uso-restringido-ue", "ida-muy-baja"],
        "efsaAdi": "0,015 mg/kg de peso corporal al día",
        "evidence": [
            {
                "body": "EFSA",
                "type": "dictamen",
                "year": 2010,
                "finding": "Rebaja la IDA de 0,8 a 0,015 mg/kg de peso corporal al día a partir de estudios de toxicidad reproductiva y de calcificación e hiperplasia renal en rata.",
                "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2010.1649",
            },
        ],
    },
    "E250": {
        "risk": "high",
        "description": (
            "El conservante típico de embutidos y jamón cocido. Protege frente "
            "a Clostridium botulinum, pero en presencia de aminas puede formar "
            "nitrosaminas. La IARC clasifica la carne procesada en el grupo 1 "
            "y la UE redujo los límites máximos en 2023."
        ),
        "flags": ["nitrosaminas", "iarc-2a-nitrosacion", "limites-reducidos-ue-2023"],
        "evidence": [
            {
                "body": "IARC",
                "type": "clasificacion",
                "year": 2010,
                "finding": "Volumen 94: la ingesta de nitrato o nitrito en condiciones que producen nitrosación endógena es probablemente cancerígena para humanos (grupo 2A).",
                "url": "https://www.ncbi.nlm.nih.gov/books/NBK326535/",
            },
            {
                "body": "IARC",
                "type": "clasificacion",
                "year": 2015,
                "finding": "Volumen 114: la carne procesada es cancerígena para humanos (grupo 1). Es una clasificación de la solidez de la evidencia, no una medida de cuánto riesgo supone una ración.",
                "url": "https://www.who.int/news-room/questions-and-answers/item/cancer-carcinogenicity-of-the-consumption-of-red-meat-and-processed-meat",
            },
            {
                "body": "Comisión Europea",
                "type": "norma",
                "year": 2023,
                "finding": "El Reglamento (UE) 2023/2108 reduce los límites máximos de nitritos y nitratos en nueve categorías de alimentos para bajar la exposición a nitrosaminas.",
                "url": "https://eur-lex.europa.eu/eli/reg/2023/2108/oj",
            },
        ],
    },
    "E320": {
        # CAMBIO DE CLASIFICACIÓN: baja de "high" a "moderate".
        # La reevaluación de la EFSA de 2011 fue favorable (subió la IDA y
        # descartó la genotoxicidad). Sostener "riesgo alto" sólo con una
        # clasificación IARC de 1986 no se aguanta con la regla documentada.
        "risk": "moderate",
        "description": (
            "Antioxidante sintético. La IARC lo clasificó en 1986 en el grupo "
            "2B (posible cancerígeno para humanos), pero la reevaluación de la "
            "EFSA de 2011 fue favorable: subió la ingesta diaria admisible a "
            "1 mg/kg y descartó problemas de genotoxicidad."
        ),
        "flags": ["iarc-2b"],
        "efsaAdi": "1,0 mg/kg de peso corporal al día",
        "evidence": [
            {
                "body": "IARC",
                "type": "clasificacion",
                "year": 1986,
                "finding": "Volumen 40: el butilhidroxianisol es posiblemente cancerígeno para humanos (grupo 2B).",
                "url": "https://monographs.iarc.who.int/agents-classified-by-the-iarc/",
            },
            {
                "body": "EFSA",
                "type": "dictamen",
                "year": 2011,
                "finding": "Establece una IDA de 1,0 mg/kg de peso corporal al día, superior a la temporal anterior de 0,5, y concluye que el BHA no plantea preocupación por genotoxicidad.",
                "url": "https://www.efsa.europa.eu/en/efsajournal/pub/2392",
            },
        ],
    },
    "E102": {
        "risk": "moderate",
        "description": "Colorante azoico amarillo. La EFSA reevaluó su seguridad en 2009 y mantuvo la IDA de 7,5 mg/kg peso corporal/día. En la UE los alimentos que lo contienen deben llevar la advertencia obligatoria «puede tener efectos negativos sobre la actividad y la atención de los niños» (Reg. 1333/2008, anexo V). La IARC no lo ha clasificado. Se han descrito reacciones de intolerancia en una fracción pequeña de la población.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "colorante-azoico"],
        "efsaAdi": "7,5 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2009,
             "finding": "El Panel concluye que la base de datos actual no da motivos para revisar la IDA de 7,5 mg/kg pc/día y que Tartrazina puede provocar reacciones de intolerancia en una fracción pequeña de la población expuesta.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1331"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Tartrazina (E 102) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
        ],
    },
    "E104": {
        "risk": "moderate",
        "description": "Colorante amarillo del grupo de las quinoleínas. En 2009 la EFSA rebajó la IDA de 10 a 0,5 mg/kg peso corporal/día. La EFSA advirtió entonces de que la ingesta estimada superaba la nueva IDA, y la UE respondió en 2012 reduciendo los niveles máximos de uso. Lleva además la advertencia obligatoria de hiperactividad en la UE. La IARC no lo ha clasificado.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "ida-reducida-efsa", "exposicion-supera-ida"],
        "efsaAdi": "0,5 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2009,
             "finding": "Aplicando un factor de incertidumbre de 100 al NOAEL de 50 mg/kg pc/día, el Panel establece una IDA de 0,5 mg/kg pc/día y señala que las estimaciones de ingesta refinadas están generalmente muy por encima de esa IDA.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1329"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Amarillo de quinoleína (E 104) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
            {"body": "Comisión Europea", "type": "norma", "year": 2012,
             "finding": "El Reglamento (UE) 232/2012 modifica el anexo II del Reglamento 1333/2008 y reduce las condiciones y los niveles de uso de E 104, E 110 y E 124, en respuesta a las IDA rebajadas por la EFSA en 2009.",
             "url": "https://eur-lex.europa.eu/eli/reg/2012/232/oj"},
        ],
    },
    "E110": {
        "risk": "moderate",
        "description": "Colorante azoico amarillo-naranja. La EFSA fijó en 2009 una IDA temporal de 1 mg/kg pc/día y en 2014, tras nuevos estudios, la restableció a 4 mg/kg pc/día concluyendo que los usos declarados no plantean preocupación de seguridad. Sigue con la advertencia obligatoria de hiperactividad en la UE.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "colorante-azoico"],
        "efsaAdi": "4 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2014,
             "finding": "El Panel concluyó que, con un NOAEL de 375 mg/kg pc/día y un factor de incertidumbre de 100, se puede establecer una nueva IDA de 4 mg/kg pc/día para Sunset Yellow FCF y que las estimaciones de exposición están muy por debajo de esa IDA.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2014.3765"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Sunset Yellow (E 110) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
            {"body": "Comisión Europea", "type": "norma", "year": 2012,
             "finding": "El Reglamento (UE) 232/2012 modifica el anexo II del Reglamento 1333/2008 y reduce las condiciones y los niveles de uso de E 104, E 110 y E 124, en respuesta a las IDA rebajadas por la EFSA en 2009.",
             "url": "https://eur-lex.europa.eu/eli/reg/2012/232/oj"},
        ],
    },
    "E122": {
        "risk": "moderate",
        "description": "Colorante azoico rojo, también llamado carmoisina. La EFSA mantuvo en 2009 la IDA de 4 mg/kg pc/día. Las estimaciones de ingesta están por debajo salvo en niños de 1 a 10 años, donde el percentil alto puede quedar ligeramente por encima. Etiquetado obligatorio de hiperactividad en la UE.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "colorante-azoico"],
        "efsaAdi": "4 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2009,
             "finding": "El Panel concluye que la base de datos actual no da motivos para revisar la IDA de 4 mg/kg pc/día, aunque en niños de 1 a 10 años el percentil alto de exposición puede ser ligeramente superior a la IDA.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1332"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Carmoisine (E 122) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
        ],
    },
    "E124": {
        "risk": "moderate",
        "description": "Colorante azoico rojo. La EFSA rebajó en 2009 la IDA de 4 a 0,7 mg/kg pc/día y advirtió de que la ingesta estimada superaba entonces la nueva IDA en adultos con consumo alto y en niños; la UE respondió en 2012 reduciendo los niveles máximos de uso. Lleva la advertencia obligatoria de hiperactividad en la UE.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "colorante-azoico", "ida-reducida-efsa", "exposicion-supera-ida"],
        "efsaAdi": "0,7 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2009,
             "finding": "El Panel establece una IDA de 0,7 mg/kg pc/día y concluye que las estimaciones de ingesta para adultos y para niños de 1 a 10 años están generalmente por encima de la IDA incluso en las estimaciones refinadas.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1328"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Ponceau 4R (E 124) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
            {"body": "Comisión Europea", "type": "norma", "year": 2012,
             "finding": "El Reglamento (UE) 232/2012 modifica el anexo II del Reglamento 1333/2008 y reduce las condiciones y los niveles de uso de E 104, E 110 y E 124, en respuesta a las IDA rebajadas por la EFSA en 2009.",
             "url": "https://eur-lex.europa.eu/eli/reg/2012/232/oj"},
        ],
    },
    "E129": {
        "risk": "moderate",
        "description": "Colorante azoico rojo. La EFSA mantuvo en 2009 la IDA de 7 mg/kg pc/día; las estimaciones están por debajo salvo en niños de 1 a 10 años, donde el percentil alto puede quedar ligeramente por encima. Lleva la advertencia obligatoria de hiperactividad en la UE. La IARC no lo ha clasificado.",
        "flags": ["southampton-six", "etiquetado-obligatorio-ue", "colorante-azoico"],
        "efsaAdi": "7 mg/kg de peso corporal al día",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2009,
             "finding": "El Panel concluyó que la base de datos actual no da motivos para revisar la IDA de 7 mg/kg pc/día y que las estimaciones de ingesta refinadas están generalmente por debajo de la IDA.",
             "url": "https://efsa.onlinelibrary.wiley.com/doi/10.2903/j.efsa.2009.1327"},
            {"body": "Comisión Europea", "type": "norma", "year": 2008,
             "finding": "Reg. 1333/2008, anexo V: los alimentos que contengan Allura Red (E 129) deben etiquetarse con la mención «puede tener efectos negativos sobre la actividad y la atención de los niños».",
             "url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R1333"},
        ],
    },
    "E220": {
        "risk": "moderate",
        "description": "Gas conservante, el más antiguo de la familia de los sulfitos. La EFSA fijó en 2016 una IDA temporal de grupo, pero en 2022 la retiró por falta de datos toxicológicos suficientes y pasó a evaluar el riesgo por margen de exposición (MOE): para consumidores altos ese margen queda por debajo del umbral de seguridad en casi todos los grupos de población. Es además un alérgeno de declaración obligatoria por su capacidad de provocar crisis de asma en personas sensibles.",
        "flags": ["alergeno-declarable", "riesgo-asma", "ida-retirada-falta-datos"],
        "efsaAdi": "IDA temporal de grupo (0,7 mg SO2 eq/kg pc/día, 2016) retirada en 2022 por datos insuficientes; se evalúa ahora por margen de exposición (MOE)",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "El Panel considera que la base de datos toxicológica disponible sigue siendo inadecuada para derivar una IDA y retira la IDA temporal de grupo fijada en 2016 (0,7 mg SO2 eq/kg pc/día); adopta en su lugar un enfoque de margen de exposición (MOE).",
             "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9685353/"},
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "Con datos de exposición realista, los MOE en el percentil 95 de consumidores altos quedan por debajo de 80 (el umbral de seguridad) en casi todos los grupos de población, lo que plantea una preocupación de seguridad para consumidores altos.",
             "url": "https://www.efsa.europa.eu/en/plain-language-summary/follow-re-evaluation-sulfur-dioxide-e-220-sodium-sulfite-e-221-sodium"},
            {"body": "FDA", "type": "norma", "year": 1986,
             "finding": "Los agentes sulfitantes deben declararse en el etiquetado de alimentos cuando están presentes en concentraciones de 10 ppm o más, por su capacidad de provocar reacciones adversas como crisis de asma en personas sensibles.",
             "url": "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies"},
        ],
    },
    "E221": {
        "risk": "moderate",
        "description": "Sal conservante y antioxidante de la familia de los sulfitos. Comparte el mismo dictamen EFSA que el resto del grupo (E220-E228): IDA temporal retirada en 2022 por falta de datos suficientes, y preocupación de seguridad por margen de exposición en consumidores altos. Alérgeno de declaración obligatoria por riesgo de crisis de asma.",
        "flags": ["alergeno-declarable", "riesgo-asma", "ida-retirada-falta-datos"],
        "efsaAdi": "IDA temporal de grupo (0,7 mg SO2 eq/kg pc/día, 2016) retirada en 2022 por datos insuficientes; se evalúa ahora por margen de exposición (MOE)",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "El Panel considera que la base de datos toxicológica disponible sigue siendo inadecuada para derivar una IDA y retira la IDA temporal de grupo fijada en 2016 (0,7 mg SO2 eq/kg pc/día); adopta en su lugar un enfoque de margen de exposición (MOE).",
             "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9685353/"},
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "Con datos de exposición realista, los MOE en el percentil 95 de consumidores altos quedan por debajo de 80 (el umbral de seguridad) en casi todos los grupos de población, lo que plantea una preocupación de seguridad para consumidores altos.",
             "url": "https://www.efsa.europa.eu/en/plain-language-summary/follow-re-evaluation-sulfur-dioxide-e-220-sodium-sulfite-e-221-sodium"},
            {"body": "FDA", "type": "norma", "year": 1986,
             "finding": "Los agentes sulfitantes deben declararse en el etiquetado de alimentos cuando están presentes en concentraciones de 10 ppm o más, por su capacidad de provocar reacciones adversas como crisis de asma en personas sensibles.",
             "url": "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies"},
        ],
    },
    "E223": {
        "risk": "moderate",
        "description": "Metabisulfito muy usado en vinificación, frutos secos y crustáceos. Comparte dictamen con el resto de sulfitos (E220-E228): IDA temporal retirada en 2022 por falta de datos suficientes, con preocupación de seguridad por margen de exposición en consumidores altos. Alérgeno de declaración obligatoria por riesgo de crisis de asma.",
        "flags": ["alergeno-declarable", "riesgo-asma", "ida-retirada-falta-datos"],
        "efsaAdi": "IDA temporal de grupo (0,7 mg SO2 eq/kg pc/día, 2016) retirada en 2022 por datos insuficientes; se evalúa ahora por margen de exposición (MOE)",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "El Panel considera que la base de datos toxicológica disponible sigue siendo inadecuada para derivar una IDA y retira la IDA temporal de grupo fijada en 2016 (0,7 mg SO2 eq/kg pc/día); adopta en su lugar un enfoque de margen de exposición (MOE).",
             "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9685353/"},
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "Con datos de exposición realista, los MOE en el percentil 95 de consumidores altos quedan por debajo de 80 (el umbral de seguridad) en casi todos los grupos de población, lo que plantea una preocupación de seguridad para consumidores altos.",
             "url": "https://www.efsa.europa.eu/en/plain-language-summary/follow-re-evaluation-sulfur-dioxide-e-220-sodium-sulfite-e-221-sodium"},
            {"body": "FDA", "type": "norma", "year": 1986,
             "finding": "Los agentes sulfitantes deben declararse en el etiquetado de alimentos cuando están presentes en concentraciones de 10 ppm o más, por su capacidad de provocar reacciones adversas como crisis de asma en personas sensibles.",
             "url": "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies"},
        ],
    },
    "E224": {
        "risk": "moderate",
        "description": "Metabisulfito potásico, habitual en vinificación como conservante. Comparte dictamen con el resto de sulfitos (E220-E228): IDA temporal retirada en 2022 por falta de datos suficientes, con preocupación de seguridad por margen de exposición en consumidores altos. Alérgeno de declaración obligatoria por riesgo de crisis de asma.",
        "flags": ["alergeno-declarable", "riesgo-asma", "ida-retirada-falta-datos"],
        "efsaAdi": "IDA temporal de grupo (0,7 mg SO2 eq/kg pc/día, 2016) retirada en 2022 por datos insuficientes; se evalúa ahora por margen de exposición (MOE)",
        "evidence": [
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "El Panel considera que la base de datos toxicológica disponible sigue siendo inadecuada para derivar una IDA y retira la IDA temporal de grupo fijada en 2016 (0,7 mg SO2 eq/kg pc/día); adopta en su lugar un enfoque de margen de exposición (MOE).",
             "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9685353/"},
            {"body": "EFSA", "type": "dictamen", "year": 2022,
             "finding": "Con datos de exposición realista, los MOE en el percentil 95 de consumidores altos quedan por debajo de 80 (el umbral de seguridad) en casi todos los grupos de población, lo que plantea una preocupación de seguridad para consumidores altos.",
             "url": "https://www.efsa.europa.eu/en/plain-language-summary/follow-re-evaluation-sulfur-dioxide-e-220-sodium-sulfite-e-221-sodium"},
            {"body": "FDA", "type": "norma", "year": 1986,
             "finding": "Los agentes sulfitantes deben declararse en el etiquetado de alimentos cuando están presentes en concentraciones de 10 ppm o más, por su capacidad de provocar reacciones adversas como crisis de asma en personas sensibles.",
             "url": "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies"},
        ],
    },
}

# E249, E251 y E252 comparten el expediente de los nitritos y nitratos: se les
# aplican las mismas evidencias que al E250, cambiando sólo la descripción.
FAMILIA_NITRITOS = {
    "E249": "Nitrito potásico, equivalente al nitrito sódico en uso y en riesgo: puede formar nitrosaminas en productos cárnicos.",
    "E251": "Nitrato sódico. El organismo lo reduce a nitrito, con el mismo riesgo de formación de nitrosaminas.",
    "E252": "Nitrato potásico, el salitre de los curados tradicionales. Se reduce a nitrito en el organismo.",
}

for codigo, descripcion in FAMILIA_NITRITOS.items():
    REVISIONES[codigo] = {
        "risk": "high",
        "description": descripcion
        + " La IARC clasifica la carne procesada en el grupo 1 y la UE redujo los límites máximos en 2023.",
        "flags": ["nitrosaminas", "iarc-2a-nitrosacion", "limites-reducidos-ue-2023"],
        "evidence": REVISIONES["E250"]["evidence"],
    }


def main() -> int:
    db = json.loads(RUTA.read_text(encoding="utf-8"))
    aditivos = db["additives"]

    faltan = [c for c in REVISIONES if c not in aditivos]
    if faltan:
        print(f"ERROR: códigos inexistentes en el diccionario: {faltan}")
        return 1

    for codigo, cambios in REVISIONES.items():
        entrada = aditivos[codigo]
        anterior = entrada["risk"]

        for clave, valor in cambios.items():
            entrada[clave] = valor
        entrada["reviewedAt"] = FECHA

        marca = "  (cambia)" if anterior != entrada["risk"] else ""
        print(f"  {codigo}: {anterior} → {entrada['risk']}{marca}")

    db["updatedAt"] = FECHA
    db["reviewPolicy"] = (
        "El nivel de riesgo se deriva de las evidencias citadas en cada entrada "
        "según la regla de docs/REVISION-ADITIVOS.md. Las entradas sin campo "
        "'evidence' siguen siendo la semilla original y están pendientes de revisar."
    )

    RUTA.write_text(
        json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    revisados = sum(1 for v in aditivos.values() if "evidence" in v)
    print(f"\nRevisados {revisados} de {len(aditivos)} aditivos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
