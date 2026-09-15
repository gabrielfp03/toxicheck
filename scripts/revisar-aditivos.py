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
    # E210-E212: el dictamen EFSA 2016 (14(3):4433) que resuelve este grupo no
    # se ha podido abrir desde este entorno (Wiley da 403 a cualquier cliente
    # automatizado, comprobado con WebFetch y con curl directo; EUR-Lex no
    # sirve contenido). Se usa en su lugar el JECFA (FAO/OMS, cuerpo permitido
    # como fuente) y la FDA para el problema conocido de formación de benceno.
    # Es una fuente distinta a la que pide el proceso por defecto: se deja
    # constancia explícita en la descripción y con el flag
    # "dictamen-efsa-no-verificado". No se rellena "efsaAdi" porque el dato
    # disponible es del JECFA, no de la EFSA.
    "E210": {
        "risk": "low",
        "description": "Conservante autorizado en la UE, presente también de forma natural en algunos alimentos. El JECFA (FAO/OMS) reevaluó en 2021 la IDA de grupo de los benzoatos y la elevó de 0-5 a 0-20 mg/kg de peso corporal/día, retirando la IDA anterior. No se ha podido verificar directamente el dictamen específico de la EFSA de 2016 (E210-E213) desde este entorno: Wiley bloquea el acceso automatizado y EUR-Lex no sirve contenido a herramientas automatizadas.",
        "flags": ["ida-jecfa-no-efsa", "dictamen-efsa-no-verificado"],
        "evidence": [
            {"body": "JECFA", "type": "dictamen", "year": 2021,
             "finding": "El Comité retira la IDA de grupo anterior de 0-5 mg/kg pc y establece una nueva IDA de grupo de 0-20 mg/kg de peso corporal, aplicando un factor de ajuste específico para la variación toxicocinética entre especies en vez del factor por defecto.",
             "url": "https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/1098"},
        ],
    },
    "E211": {
        "risk": "low",
        "description": "Conservante muy usado en refrescos y salsas. El JECFA (FAO/OMS) reevaluó en 2021 la IDA de grupo de los benzoatos y la elevó de 0-5 a 0-20 mg/kg de peso corporal/día. En presencia de vitamina C y calor o luz puede formar trazas de benceno; la FDA analizó cientos de muestras de bebidas y concluyó que los niveles encontrados no suponen un problema de seguridad para los consumidores. No se ha podido verificar directamente el dictamen específico de la EFSA de 2016 (E210-E213) desde este entorno: Wiley bloquea el acceso automatizado y EUR-Lex no sirve contenido a herramientas automatizadas.",
        "flags": ["formacion-benceno-con-vitamina-c", "ida-jecfa-no-efsa", "dictamen-efsa-no-verificado"],
        "evidence": [
            {"body": "JECFA", "type": "dictamen", "year": 2021,
             "finding": "El Comité retira la IDA de grupo anterior de 0-5 mg/kg pc y establece una nueva IDA de grupo de 0-20 mg/kg de peso corporal, aplicando un factor de ajuste específico para la variación toxicocinética entre especies en vez del factor por defecto.",
             "url": "https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/1098"},
            {"body": "FDA", "type": "dictamen", "year": 2022,
             "finding": "El benceno puede formarse a niveles muy bajos (ppb) en algunas bebidas que contienen sales de benzoato y ácido ascórbico (vitamina C), favorecido por la exposición al calor y la luz; la encuesta de la FDA concluye que los niveles encontrados hasta la fecha no suponen un problema de seguridad para los consumidores. Página con fecha «content current as of» 02/25/2022.",
             "url": "https://www.fda.gov/food/environmental-contaminants-food/questions-and-answers-occurrence-benzene-soft-drinks-and-other-beverages"},
        ],
    },
    "E212": {
        "risk": "low",
        "description": "Benzoato potásico, con el mismo perfil que el benzoato sódico, incluida la posible formación de trazas de benceno junto a vitamina C. El JECFA (FAO/OMS) reevaluó en 2021 la IDA de grupo de los benzoatos y la elevó de 0-5 a 0-20 mg/kg de peso corporal/día. No se ha podido verificar directamente el dictamen específico de la EFSA de 2016 (E210-E213) desde este entorno: Wiley bloquea el acceso automatizado y EUR-Lex no sirve contenido a herramientas automatizadas.",
        "flags": ["formacion-benceno-con-vitamina-c", "ida-jecfa-no-efsa", "dictamen-efsa-no-verificado"],
        "evidence": [
            {"body": "JECFA", "type": "dictamen", "year": 2021,
             "finding": "El Comité retira la IDA de grupo anterior de 0-5 mg/kg pc y establece una nueva IDA de grupo de 0-20 mg/kg de peso corporal, aplicando un factor de ajuste específico para la variación toxicocinética entre especies en vez del factor por defecto.",
             "url": "https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/1098"},
            {"body": "FDA", "type": "dictamen", "year": 2022,
             "finding": "El benceno puede formarse a niveles muy bajos (ppb) en algunas bebidas que contienen sales de benzoato y ácido ascórbico (vitamina C), favorecido por la exposición al calor y la luz; la encuesta de la FDA concluye que los niveles encontrados hasta la fecha no suponen un problema de seguridad para los consumidores. Página con fecha «content current as of» 02/25/2022.",
             "url": "https://www.fda.gov/food/environmental-contaminants-food/questions-and-answers-occurrence-benzene-soft-drinks-and-other-beverages"},
        ],
    },
}

# E338, E339, E340, E341, E450, E451, E452: comprobado (no presumido) que
# comparten un único dictamen EFSA de 2019 (14(6):5674), que evalúa el
# fósforo/fosfatos como grupo: E 338-341, E 343 y E 450-452. E343 (fosfatos
# de magnesio) no está en el diccionario de Toxicheck, así que no se añade
# aquí. Es el ejemplo que cita textualmente docs/REVISION-ADITIVOS.md para
# "moderate": IDA de grupo con exposición estimada por encima del límite en
# parte de la población.
_FOSFATOS_EVIDENCE = [
    {"body": "EFSA", "type": "dictamen", "year": 2019,
     "finding": "El Panel establece una IDA de grupo de 40 mg/kg de peso corporal al día, expresada como fósforo, para el conjunto de fosfatos (E 338-341, E 343, E 450-452). Los considera de baja toxicidad aguda oral y sin problemas de genotoxicidad ni carcinogenicidad.",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009158/"},
    {"body": "EFSA", "type": "dictamen", "year": 2019,
     "finding": "En el escenario de exposición estimada, la ingesta media supera la IDA de grupo en lactantes, niños pequeños y niños, y el percentil 95 la supera también en adolescentes; no hay preocupación de seguridad en menores de 16 semanas alimentados con fórmula o alimentos para usos médicos especiales.",
     "url": "https://www.efsa.europa.eu/en/press/news/190612"},
]
_FOSFATOS_ADI = "IDA de grupo: 40 mg/kg de peso corporal al día, expresada como fósforo (EFSA, 2019)"
_FOSFATOS_FLAGS = ["ida-grupo-superada-ninos", "exposicion-fosfatos"]

REVISIONES["E338"] = {
    "risk": "moderate",
    "description": "Acidulante de refrescos de cola y otras bebidas. Comparte la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes, por la suma de fosfatos de todas las fuentes de la dieta.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E339"] = {
    "risk": "moderate",
    "description": "Fosfatos de sodio, usados como estabilizante y regulador de acidez. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E340"] = {
    "risk": "moderate",
    "description": "Fosfatos de potasio, usados como estabilizante y regulador de acidez. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E341"] = {
    "risk": "moderate",
    "description": "Fosfatos de calcio, usados como antiaglomerante y enriquecedor. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E450"] = {
    "risk": "moderate",
    "description": "Difosfatos, usados como gasificante y retenedor de agua. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E451"] = {
    "risk": "moderate",
    "description": "Trifosfatos, usados como retenedor de agua en carnes y pescados procesados. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}
REVISIONES["E452"] = {
    "risk": "moderate",
    "description": "Polifosfatos, muy usados en quesos fundidos y carnes procesadas. Comparten la IDA de grupo de los fosfatos que la EFSA fijó en 2019: 40 mg/kg de peso corporal al día como fósforo. La ingesta media ya supera esa IDA en lactantes, niños pequeños y niños, y el percentil 95 también en adolescentes.",
    "flags": _FOSFATOS_FLAGS,
    "efsaAdi": _FOSFATOS_ADI,
    "evidence": _FOSFATOS_EVIDENCE,
}

# --- Edulcorantes (E950, E951, E952, E954, E955, E961, E968) --------------
# No comparten expediente entre sí (cada uno tiene su propia reevaluación
# EFSA, en años distintos); se resuelven por separado. La mayoría se
# reevaluó entre 2023 y 2026 y salió con IDA más holgada y "sin preocupación
# de seguridad", lo que baja el nivel de varios. El ciclamato es la excepción
# que sube: la FDA lo retiró de la lista GRAS en 1969 por motivos de
# seguridad, el mismo criterio que ya aplica a E123/E127 en este diccionario.

REVISIONES["E950"] = {
    "risk": "low",
    "description": "Edulcorante sintético autorizado en la UE. La EFSA completó en 2025 su reevaluación y elevó la IDA de 9 a 15 mg/kg de peso corporal al día; concluye que las estimaciones de exposición actuales no indican preocupación de seguridad. Es un marcador de ultraprocesado sin problema toxicológico propio identificado en la reevaluación.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "15 mg/kg de peso corporal al día (EFSA, 2025; sustituye los 9 mg/kg fijados en 2000)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2025,
         "finding": "El Panel eleva la IDA de acesulfamo K de 9 a 15 mg/kg de peso corporal al día, a partir de un NOAEL de 1500 mg/kg pc/día en rata, y concluye que las estimaciones actuales de exposición dietética no indican preocupación de seguridad para el acesulfamo K.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12041894/"},
        {"body": "EFSA", "type": "dictamen", "year": 2025,
         "finding": "En la UE, la estimación de exposición más alta al E 950 se sitúa generalmente por debajo de la IDA en todos los grupos de población, sin indicar preocupación de seguridad.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-acesulfame-k-e-950-food-additive"},
    ],
}
REVISIONES["E951"] = {
    "risk": "moderate",
    "description": "Edulcorante sintético, el más estudiado del mercado. En 2023 la IARC lo clasificó como posible cancerígeno para humanos (grupo 2B) por evidencia limitada de cáncer de hígado, mientras que el JECFA, ese mismo año, reafirmó la IDA de 40 mg/kg de peso corporal al día tras no hallar evidencia convincente de efectos adversos. La reevaluación de la EFSA de 2013 llegó a la misma conclusión de seguridad. Está contraindicado en personas con fenilcetonuria, que deben evitar cualquier fuente de fenilalanina.",
    "flags": ["iarc-2b", "fenilcetonuria"],
    "efsaAdi": "40 mg/kg de peso corporal al día (EFSA 2013 y JECFA 2023, sin cambios)",
    "evidence": [
        {"body": "IARC", "type": "clasificacion", "year": 2023,
         "finding": "El Grupo de Trabajo clasifica el aspartamo como posiblemente cancerígeno para humanos (grupo 2B), por evidencia limitada de cáncer en humanos (carcinoma hepatocelular), evidencia limitada en animales de experimentación y evidencia mecanicista limitada. Publicado en el volumen 134 de las IARC Monographs.",
         "url": "https://monographs.iarc.who.int/news-events/iarc-monographs-evaluation-of-the-carcinogenicity-of-aspartame-methyleugenol-and-isoeugenol"},
        {"body": "JECFA", "type": "dictamen", "year": 2023,
         "finding": "El Comité reafirma la ingesta diaria admisible de 40 mg/kg de peso corporal; con una lata de refresco light de 200-300 mg de aspartamo, un adulto de 70 kg necesitaría consumir más de 9-14 latas al día para superar la IDA.",
         "url": "https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment-results-released"},
        {"body": "EFSA", "type": "dictamen", "year": 2013,
         "finding": "El aspartamo y sus productos de degradación son seguros para el consumo humano a los niveles de exposición actuales; la IDA de 40 mg/kg de peso corporal al día es protectora para la población general.",
         "url": "https://www.efsa.europa.eu/en/press/news/131210"},
        {"body": "EFSA", "type": "dictamen", "year": 2013,
         "finding": "Para pacientes con fenilcetonuria la IDA no es aplicable, ya que requieren una adherencia estricta a una dieta baja en fenilalanina, un aminoácido presente en muchos alimentos con proteína.",
         "url": "https://www.efsa.europa.eu/en/topics/topic/aspartame"},
    ],
}
REVISIONES["E952"] = {
    "risk": "high",
    "description": "Edulcorante sintético. La FDA lo retiró de su lista GRAS (reconocidos como seguros) en 1969 por motivos de seguridad y sigue prohibido en Estados Unidos. Estudios posteriores no lograron reproducir el hallazgo original y organismos como el JECFA lo consideran seguro con una IDA establecida (0-7 mg/kg de peso corporal al día, fijada en 2000 por el precursor de la EFSA), y en la UE sigue autorizado; pero la prohibición estadounidense no se ha revocado y la EFSA aún no ha publicado una reevaluación propia que la sustituya.",
    "flags": ["prohibido-eeuu"],
    "evidence": [
        {"body": "FDA", "type": "norma", "year": 1969,
         "finding": "En 1969 la FDA retiró las sales de ciclamato de su lista GRAS (reconocidas como seguras) por motivos de seguridad.",
         "url": "https://www.fda.gov/food/generally-recognized-safe-gras/fdas-approach-gras-provision-history-processes"},
    ],
}
REVISIONES["E954"] = {
    "risk": "low",
    "description": "El edulcorante sintético más antiguo. La EFSA completó en 2024 su reevaluación y elevó la IDA a 9 mg/kg de peso corporal al día (como imida libre); confirma que los tumores de vejiga observados en estudios antiguos en rata son específicos de esa especie y no relevantes para el ser humano. No hay preocupación de seguridad a los niveles de exposición actuales.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "9 mg/kg de peso corporal al día, como imida libre (EFSA, 2024)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2024,
         "finding": "El Panel establece una nueva IDA de 9 mg/kg de peso corporal al día (como imida libre); la IDA anterior se basaba en el aumento de tumores de vejiga en estudios en rata, pero existe ahora acuerdo científico en que esos tumores son específicos de ratas macho y no relevantes para humanos.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-saccharin-and-its-sodium-potassium-and-calcium-salts-e-954"},
    ],
}
REVISIONES["E955"] = {
    "risk": "low",
    "description": "Edulcorante clorado. La reevaluación más reciente de la EFSA mantiene la IDA en 15 mg/kg de peso corporal al día, sin problemas de genotoxicidad, y concluye que no hay preocupación de seguridad en los usos autorizados. Señala incertidumbre sobre posibles compuestos de degradación si se somete a temperaturas altas y prolongadas en el ámbito doméstico (freír, hornear), por lo que no es apta para cocinar a esas temperaturas.",
    "flags": ["no-apta-para-hornear", "marcador-ultraprocesado"],
    "efsaAdi": "15 mg/kg de peso corporal al día (EFSA, sin cambios respecto a la IDA anterior)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2026,
         "finding": "El Panel no encuentra preocupación de seguridad por genotoxicidad de la sucralosa ni de sus impurezas y productos de degradación, y reafirma la IDA de 15 mg/kg de peso corporal al día; la sucralosa sigue siendo segura en las condiciones de uso autorizadas en la UE.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-sucralose-e-955-food-additive"},
        {"body": "EFSA", "type": "dictamen", "year": 2026,
         "finding": "Existe incertidumbre sobre la posible transferencia de cloro desde la sucralosa a otras moléculas orgánicas bajo condiciones prolongadas de alta temperatura, como freír u hornear en el ámbito doméstico; esas condiciones no se dan en el procesado industrial autorizado.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-sucralose-e-955-food-additive"},
    ],
}
REVISIONES["E961"] = {
    "risk": "low",
    "description": "Edulcorante derivado del aspartamo, unas 10.000 veces más dulce que el azúcar. La EFSA completó en 2025 su reevaluación y elevó la IDA de 2 a 10 mg/kg de peso corporal al día; concluye que no hay preocupación de seguridad en los usos y niveles permitidos. Su uso real en la UE es muy escaso y la exposición estimada queda muy por debajo de la IDA incluso en los escenarios más conservadores.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "10 mg/kg de peso corporal al día (EFSA, 2025; sustituye los 2 mg/kg fijados en 2007)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2025,
         "finding": "El Panel eleva la IDA de neotamo de 2 a 10 mg/kg de peso corporal al día, a partir de un NOAEL de 1000 mg/kg pc/día en estudios crónicos y de carcinogenicidad en rata, y concluye que no hay preocupación de seguridad en los usos y niveles de uso permitidos y notificados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12231243/"},
    ],
}
REVISIONES["E968"] = {
    "risk": "moderate",
    "description": "Poliol de origen natural, muy usado como edulcorante de mesa y en productos «sin azúcar». La EFSA completó en 2023 su reevaluación y fijó una IDA de 0,5 g/kg de peso corporal al día por su efecto laxante; tanto la exposición aguda como la crónica superan esa IDA en todos los grupos de población con un consumo habitual, por lo que se mantiene la advertencia de etiquetado por posible efecto laxante. La propia EFSA señala que la evidencia actual no muestra una relación de causa-efecto entre el consumo de eritritol y un mayor riesgo cardiovascular, aunque pide más investigación.",
    "flags": ["ida-superada-todos-grupos", "efecto-laxante", "advertencia-etiquetado-laxante"],
    "efsaAdi": "0,5 g/kg de peso corporal al día (EFSA, 2023), superada por la exposición habitual en todos los grupos de población",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2023,
         "finding": "El Panel fija una IDA de 0,5 g/kg de peso corporal al día a partir del NOAEL más bajo relacionado con la prevención de diarrea; tanto la exposición aguda como la crónica al eritritol superan esa IDA en todos los grupos de población, por lo que la advertencia de etiquetado por efecto laxante sigue siendo válida.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-erythritol-e-968-food-additive"},
        {"body": "EFSA", "type": "dictamen", "year": 2023,
         "finding": "La evidencia actual no muestra una relación de causa-efecto entre el consumo de alimentos con eritritol y un mayor riesgo de enfermedad cardiovascular; el Panel señala que sería útil más investigación para aclarar la naturaleza de la asociación observada en algunos estudios observacionales.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-erythritol-e-968-food-additive"},
    ],
}

# --- Resto de moderados (E131, E132, E150c, E150d, E321, E385, E407, E432,
#     E433, E466, E551, E553b, E627, E631, E635) ----------------------------
# E131, E150c y E150d quedan SIN RESOLVER: sus dictámenes EFSA (2013 y 2011
# respectivamente) sólo existen en Wiley, que da 403 a cualquier cliente
# automatizado, y no hay resumen en lenguaje llano ni copia en PMC para
# opiniones tan antiguas. No se tocan sus entradas.
#
# E432/E433 comparten un único dictamen EFSA de 2015 para el grupo de
# polisorbatos (E432-E436): comprobado, no presumido.
# E627/E631 tienen fichas JECFA separadas pero ambas con IDA de grupo "no
# especificada"; E635 es literalmente la mezcla 1:1 de ambos, así que
# reutiliza la misma evidencia en vez de buscarla por separado.

_POLISORBATOS_EVIDENCE = [
    {"body": "EFSA", "type": "dictamen", "year": 2015,
     "finding": "El Panel establece una IDA de grupo de 25 mg/kg de peso corporal al día para los polisorbatos (E432-E436) y concluye que no hay preocupación respecto a genotoxicidad, carcinogenicidad ni toxicidad para el desarrollo; señala que para tres categorías de alimentos no se obtuvieron datos de uso, y que la exposición en niños pequeños en el escenario no fiel a una marca alcanza 24,5 mg/kg pc/día, muy cerca del límite de 25.",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13151592/"},
]
_POLISORBATOS_ADI = "IDA de grupo: 25 mg/kg de peso corporal al día (EFSA, 2015); la exposición en niños pequeños llega a 24,5 mg/kg, muy cerca del límite"
_POLISORBATOS_FLAGS = ["ida-grupo-cerca-limite-ninos", "datos-uso-incompletos"]

REVISIONES["E432"] = {
    "risk": "moderate",
    "description": "Emulgente sintético (polisorbato 20). Comparte con el resto de polisorbatos (E432-E436) la IDA de grupo de 25 mg/kg de peso corporal al día que fijó la EFSA en 2015; no hay preocupación por genotoxicidad, carcinogenicidad ni toxicidad para el desarrollo, pero la exposición estimada en niños pequeños llega a 24,5 mg/kg, muy cerca del límite, y faltan datos de uso para tres categorías de alimentos.",
    "flags": _POLISORBATOS_FLAGS,
    "efsaAdi": _POLISORBATOS_ADI,
    "evidence": _POLISORBATOS_EVIDENCE,
}
REVISIONES["E433"] = {
    "risk": "moderate",
    "description": "Emulgente sintético (polisorbato 80). Comparte con el resto de polisorbatos (E432-E436) la IDA de grupo de 25 mg/kg de peso corporal al día que fijó la EFSA en 2015; no hay preocupación por genotoxicidad, carcinogenicidad ni toxicidad para el desarrollo, pero la exposición estimada en niños pequeños llega a 24,5 mg/kg, muy cerca del límite, y faltan datos de uso para tres categorías de alimentos.",
    "flags": _POLISORBATOS_FLAGS,
    "efsaAdi": _POLISORBATOS_ADI,
    "evidence": _POLISORBATOS_EVIDENCE,
}

_NUCLEOTIDOS_EVIDENCE = [
    {"body": "JECFA", "type": "dictamen", "year": 1993,
     "finding": "IDA de grupo para el ácido guanílico y sus sales de calcio, disodio y dipotasio: «not specified». El Comité concluyó que la ingesta combinada de disodium 5'-guanylate y disodium 5'-inosinate no es de importancia toxicológica.",
     "url": "https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/822"},
    {"body": "JECFA", "type": "dictamen", "year": 1993,
     "finding": "IDA de grupo para el ácido inosínico y sus sales de calcio, disodio y dipotasio: «not specified».",
     "url": "https://apps.who.int/food-additives-contaminants-jecfa-database/Home/Chemical/2512"},
]
_NUCLEOTIDOS_ADI = "IDA de grupo «no especificada» (JECFA, 1993); la EFSA tiene abierta una reevaluación como aditivos alimentarios (E626-E635) sin dictamen todavía"
_NUCLEOTIDOS_FLAGS = ["marcador-ultraprocesado", "reevaluacion-efsa-en-curso"]

REVISIONES["E627"] = {
    "risk": "low",
    "description": "Potenciador del sabor derivado de nucleótidos. El JECFA le asigna una IDA de grupo «no especificada» junto con el resto de sales del ácido guanílico, y concluye que la ingesta combinada con el inosinato no es de importancia toxicológica. La EFSA tiene abierta desde 2023 una convocatoria de datos para su reevaluación como aditivo alimentario (E626-E635), todavía sin dictamen publicado.",
    "flags": _NUCLEOTIDOS_FLAGS,
    "efsaAdi": _NUCLEOTIDOS_ADI,
    "evidence": _NUCLEOTIDOS_EVIDENCE,
}
REVISIONES["E631"] = {
    "risk": "low",
    "description": "Potenciador del sabor derivado de nucleótidos, suele acompañar al E627. El JECFA le asigna una IDA de grupo «no especificada» junto con el resto de sales del ácido inosínico. La EFSA tiene abierta desde 2023 una convocatoria de datos para su reevaluación como aditivo alimentario (E626-E635), todavía sin dictamen publicado.",
    "flags": _NUCLEOTIDOS_FLAGS,
    "efsaAdi": _NUCLEOTIDOS_ADI,
    "evidence": _NUCLEOTIDOS_EVIDENCE,
}
REVISIONES["E635"] = {
    "risk": "low",
    "description": "Mezcla 1:1 de E627 (guanilato disódico) y E631 (inosinato disódico), con el mismo perfil que ambos: IDA de grupo «no especificada» por el JECFA. La EFSA tiene abierta desde 2023 una convocatoria de datos para reevaluar el conjunto de ribonucleótidos (E626-E635) como aditivos alimentarios, todavía sin dictamen publicado.",
    "flags": _NUCLEOTIDOS_FLAGS,
    "efsaAdi": _NUCLEOTIDOS_ADI,
    "evidence": _NUCLEOTIDOS_EVIDENCE,
}

REVISIONES["E132"] = {
    "risk": "low",
    "description": "Colorante azul sintético. La EFSA reafirmó en 2014 la IDA de 5 mg/kg de peso corporal al día que ya había fijado el JECFA en 1975, sin preocupación por genotoxicidad. Un seguimiento de 2023 confirmó la misma IDA con especificaciones de pureza revisadas y concluyó que no hay preocupación de seguridad a los niveles de uso declarados.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "5 mg/kg de peso corporal al día (JECFA 1975, reafirmada por la EFSA en 2014 y 2023)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2023,
         "finding": "El Panel concluye que no hay preocupación de seguridad por el uso de indigotina (E 132), sales disódicas, cumpliendo la revisión propuesta de la especificación, a los niveles de uso declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10369292/"},
    ],
}
REVISIONES["E321"] = {
    "risk": "moderate",
    "description": "Antioxidante sintético emparentado con el BHA (E320). La EFSA fijó en 2012 una IDA de 0,25 mg/kg de peso corporal al día; no hay preocupación por genotoxicidad y considera que una posible carcinogenicidad tendría umbral. La exposición media de los adultos no supera esa IDA, pero sí se supera en el percentil 95 de los niños en algunos países europeos (Finlandia, Países Bajos).",
    "flags": ["ida-superada-ninos-percentil-95"],
    "efsaAdi": "0,25 mg/kg de peso corporal al día",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2012,
         "finding": "El Panel deriva una IDA de 0,25 mg/kg pc/día; el BHT no plantea preocupación de genotoxicidad y cualquier carcinogenicidad tendría umbral. La exposición de los niños no suele superar la IDA de media, pero sí se supera en el percentil 95 en algunos países europeos (Finlandia, Países Bajos).",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13151845/"},
    ],
}
REVISIONES["E385"] = {
    "risk": "moderate",
    "description": "Quelante que puede interferir en la absorción de minerales como el zinc y el hierro. Su IDA (2,5 mg/kg de peso corporal al día) la fijó el JECFA en 1974, antes de que existiera la EFSA. La EFSA todavía no ha completado su propia reevaluación como aditivo alimentario: en el marco de un dictamen relacionado de 2018 señaló que hacen falta más estudios de toxicidad para completarla.",
    "flags": ["reevaluacion-efsa-en-curso"],
    "efsaAdi": "2,5 mg/kg de peso corporal al día (JECFA, 1974; la EFSA aún no ha completado su propia reevaluación)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2018,
         "finding": "El Panel señala que harán falta estudios de toxicidad adicionales para completar la reevaluación del EDTA cálcico disódico (E 385) como aditivo alimentario, y que la EFSA estableció en 1974 una IDA de 2,5 mg/kg pc/día para esta sustancia.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009604/"},
    ],
}
REVISIONES["E407"] = {
    "risk": "moderate",
    "description": "Espesante extraído de algas. La EFSA reevaluó en 2018 el carragenano y consideró que la IDA de grupo existente (75 mg/kg de peso corporal al día) debe tratarse como temporal por incertidumbres en los datos. Señaló que el carragenano degradado (poligeenano, una sustancia distinta del aditivo, no autorizada como tal) provoca colitis y tumores en ratas, y que los indicios de que el carragenano pueda agravar la enfermedad inflamatoria intestinal en humanos «necesitan aclararse».",
    "flags": ["ida-temporal-datos-insuficientes", "inflamacion-intestinal-estudios-animales"],
    "efsaAdi": "IDA de grupo temporal: 75 mg/kg de peso corporal al día (EFSA, 2018)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2018,
         "finding": "La IDA de grupo existente para carragenano (E 407) y alga Eucheuma procesada (E 407a) de 75 mg/kg pc/día debe considerarse temporal. Los resultados que sugieren que el carragenano podría agravar la enfermedad inflamatoria intestinal en humanos necesitan aclararse.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009739/"},
    ],
}
REVISIONES["E466"] = {
    "risk": "low",
    "description": "Espesante y estabilizante sintético (carboximetilcelulosa sódica). El JECFA le asignó en 1989 una IDA «no especificada» y la EFSA concluyó en 2018 que no hay preocupación de seguridad a los niveles de uso declarados. El propio Panel recoge un estudio en ratón que asocia este tipo de emulgentes con alteración de la microbiota e inflamación intestinal, pero señala que ese efecto no se estudia de forma sistemática en los ensayos de toxicidad estándar.",
    "flags": ["microbiota-estudio-raton"],
    "efsaAdi": "IDA no especificada (JECFA 1989, confirmada por la EFSA en 2018)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2018,
         "finding": "No hace falta una IDA numérica y no hay preocupación de seguridad a los niveles de uso declarados para las celulosas sin modificar y modificadas (E 460(i), E 460(ii), E 461-466, E 468 y E 469). El Panel recoge que la carboximetilcelulosa está entre los aditivos que, en un estudio en ratón, se asoció a alteración de la microbiota intestinal, promoción de inflamación intestinal, obesidad y peor control glucémico.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009359/"},
    ],
}
REVISIONES["E551"] = {
    "risk": "low",
    "description": "Antiaglomerante (dióxido de silicio). La EFSA no pudo concluir en 2018 por falta de caracterización de la fracción nanoparticulada, pero su seguimiento de 2024 concluye que el E551 no plantea preocupación de seguridad en ningún grupo de población, incluidos los lactantes menores de 16 semanas. Sigue sin poder fijarse una IDA numérica por las limitaciones de los datos disponibles: el Panel evalúa el riesgo por margen de exposición (MOE) en su lugar.",
    "flags": ["nanoparticulas", "sin-ida-numerica"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2024,
         "finding": "El E 551 no plantea preocupación de seguridad en ningún grupo de población, incluidos los lactantes menores de 16 semanas. Sigue faltando información sobre la proporción de partículas de E 551 presentes como nanopartículas aisladas, agregados y aglomerados nanométricos en el alimento; el Panel aplica un enfoque de margen de exposición (MOE) en vez de fijar una IDA por las limitaciones de los datos disponibles.",
         "url": "https://www.efsa.europa.eu/en/plain-language-summary/re-evaluation-silicon-dioxide-e-551-food-additive-foods-infants-below-16"},
    ],
}
REVISIONES["E553b"] = {
    "risk": "moderate",
    "description": "Antiaglomerante mineral. La EFSA concluyó en 2018 que la seguridad del talco como aditivo alimentario no puede evaluarse por falta de estudios fiables de toxicidad subcrónica, crónica, carcinogenicidad y toxicidad reproductiva. Las especificaciones de la UE exigen que esté libre de amianto (comprobado mediante el ensayo de anfíboles y serpentinas), pero el Panel señala que puede contener otros minerales asociados —cuarzo cristalino alfa, fluorita, níquel— sin límites máximos establecidos.",
    "flags": ["datos-insuficientes-efsa", "contaminantes-minerales-sin-limite"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2018,
         "finding": "Faltan datos fiables de toxicidad subcrónica, crónica, carcinogenicidad y toxicidad reproductiva de los silicatos y el talco, por lo que su seguridad no puede evaluarse. Las especificaciones de la UE exigen que el talco esté libre de amianto según el ensayo de anfíboles y serpentinas, pero puede contener cuarzo cristalino alfa, fluorita y níquel sin límite máximo establecido.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009349/"},
    ],
}

# --- Riesgo bajo, primera mitad (E120, E133, E150c/d*, E153, E160b, E172*,
#     E200, E202, E203, E235*, E280*, E282*, E316*, E412, E415) -------------
# * = sin resolver esta tanda: dictamen sólo en Wiley (403) y sin resumen ni
#     copia en PMC. E141 (no listado abajo) también sin resolver, mismo
#     motivo.
#
# El hallazgo importante de esta tanda es E203: no es que su dictamen sea
# favorable, es que el aditivo ya NO ESTÁ AUTORIZADO en la UE desde 2018.
# La entrada anterior ("mismo perfil que el sorbato potásico") es del todo
# obsoleta.
#
# E200 y E202 comparten IDA de grupo (comprobado en el seguimiento de 2019).
# E203 se excluyó de ese grupo, no por generar peor evidencia toxicológica,
# sino porque nadie presentó nunca los estudios de genotoxicidad pedidos
# y la Comisión optó por retirarlo en vez de seguir esperando.

REVISIONES["E120"] = {
    "risk": "low",
    "description": "Colorante rojo obtenido del insecto cochinilla. La EFSA reevaluó en 2015 la IDA y la expresó como contenido de ácido carmínico: 2,5 mg/kg de peso corporal al día (antes 5 mg/kg como carmín). La exposición estimada, en el escenario no fiel a una marca, queda por debajo de esa IDA en todos los grupos de población.",
    "flags": ["posible-alergeno", "no-vegano"],
    "efsaAdi": "2,5 mg de ácido carmínico/kg de peso corporal al día (EFSA, 2015)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2015,
         "finding": "El Panel expresa la IDA como contenido de ácido carmínico, 2,5 mg/kg pc/día, y concluye que la exposición a E 120 en el escenario no fiel a una marca está por debajo de esa IDA en todos los grupos de población.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13189440/"},
    ],
}
REVISIONES["E133"] = {
    "risk": "moderate",
    "description": "Colorante azul sintético. La EFSA rebajó en 2010 la IDA de 10 a 6 mg/kg de peso corporal al día. Con las estimaciones más refinadas (nivel de detalle más alto) la exposición queda por debajo de la IDA, pero con estimaciones menos refinadas se supera en niños en el percentil 95 de consumo.",
    "flags": ["ida-superada-ninos-percentil-95"],
    "efsaAdi": "6 mg/kg de peso corporal al día (EFSA, 2010; antes 10 mg/kg)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2010,
         "finding": "El Panel establece una nueva IDA de 6 mg/kg pc/día. Con las estimaciones refinadas (nivel 3) la ingesta queda por debajo de la IDA, pero con las estimaciones de nivel 2 se supera en el percentil 95 de consumo en niños.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13129995/"},
    ],
}
REVISIONES["E153"] = {
    "risk": "low",
    "description": "Colorante negro de origen vegetal. La EFSA consideró en 2012 los datos toxicológicos demasiado limitados para fijar una IDA, pero concluyó que no supone un problema de seguridad a los niveles de uso declarados, siempre que el contenido residual de hidrocarburos aromáticos policíclicos (expresado como benzo[a]pireno) se mantenga por debajo de 1,0 µg/kg.",
    "flags": ["datos-limitados-sin-ida"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2012,
         "finding": "El Panel considera los datos toxicológicos disponibles demasiado limitados para fijar una IDA, pero concluye que el carbón vegetal (E 153) con menos de 1,0 µg/kg de PAH cancerígenos residuales (expresado como benzo[a]pireno) no supone un problema de seguridad a los niveles de uso declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13136860/"},
    ],
}
REVISIONES["E160b"] = {
    "risk": "low",
    "description": "Colorante naranja natural (achiote). La EFSA fijó en 2016 una IDA de 6 mg/kg de peso corporal al día para la bixina y de 0,3 mg/kg para la norbixina, sus dos principios colorantes. Con los usos actualmente autorizados, la exposición estimada queda por debajo de ambas IDA en todos los grupos de población; solo se detectó una posible superación de la IDA de norbixina en un escenario de ampliación de uso todavía no autorizada.",
    "flags": ["posible-alergeno"],
    "efsaAdi": "Bixina: 6 mg/kg pc/día; norbixina: 0,3 mg/kg pc/día (EFSA, 2016)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2016,
         "finding": "El Panel fija una IDA de 6 mg bixina/kg pc/día y 0,3 mg norbixina/kg pc/día. Con los escenarios de exposición refinada para los usos ya autorizados, la exposición a bixina y a norbixina queda por debajo de sus respectivas IDA en todos los grupos de población.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009150/"},
    ],
}
REVISIONES["E200"] = {
    "risk": "low",
    "description": "Conservante antifúngico de baja toxicidad. La EFSA fijó en 2015 una IDA de grupo temporal para el ácido sórbico (E 200) y el sorbato potásico (E 202), y en 2019, tras un estudio ampliado de toxicidad reproductiva, la confirmó y elevó a 11 mg de ácido sórbico/kg de peso corporal al día.",
    "flags": [],
    "efsaAdi": "11 mg de ácido sórbico/kg de peso corporal al día (IDA de grupo con E202, EFSA 2019)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2019,
         "finding": "Aplicando un factor de incertidumbre de 100 a los resultados de un estudio ampliado de toxicidad reproductiva de una generación, el Panel establece una IDA de grupo de 11 mg de ácido sórbico/kg pc/día para el ácido sórbico (E 200) y su sal potásica (E 202).",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009143/"},
    ],
}
REVISIONES["E202"] = {
    "risk": "low",
    "description": "El conservante antifúngico más habitual. Comparte con el ácido sórbico (E 200) la IDA de grupo que la EFSA confirmó y elevó en 2019 a 11 mg de ácido sórbico/kg de peso corporal al día tras un estudio ampliado de toxicidad reproductiva.",
    "flags": [],
    "efsaAdi": "11 mg de ácido sórbico/kg de peso corporal al día (IDA de grupo con E200, EFSA 2019)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2019,
         "finding": "Aplicando un factor de incertidumbre de 100 a los resultados de un estudio ampliado de toxicidad reproductiva de una generación, el Panel establece una IDA de grupo de 11 mg de ácido sórbico/kg pc/día para el ácido sórbico (E 200) y su sal potásica (E 202).",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009143/"},
    ],
}
REVISIONES["E203"] = {
    # CAMBIO DE CLASIFICACIÓN: sube de "low" a "high". No es que se haya
    # encontrado un problema toxicológico nuevo: es que nadie presentó nunca
    # los estudios de genotoxicidad que pedía la EFSA, y la Comisión retiró
    # el aditivo de la lista de autorizados en 2018. Prohibido en la UE
    # encaja de forma literal con el primer criterio de "high".
    "risk": "high",
    "description": "El sorbato cálcico ya NO está autorizado como aditivo alimentario en la UE: la Comisión lo retiró de la lista de aditivos mediante el Reglamento (UE) 2018/98, de 22 de enero de 2018, después de que nadie presentara los estudios de genotoxicidad que la EFSA había pedido en su reevaluación. No es un problema de toxicidad demostrada, sino de datos nunca aportados que llevaron a la retirada.",
    "flags": ["prohibido-ue"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2019,
         "finding": "El sorbato cálcico (E 203) ha sido retirado de la lista de aditivos alimentarios mediante el Reglamento (UE) 2018/98 de la Comisión, de 22 de enero de 2018, al no haberse presentado los estudios de genotoxicidad solicitados por ningún operador.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009143/"},
    ],
}
REVISIONES["E412"] = {
    "risk": "low",
    "description": "Fibra soluble usada como espesante. La EFSA concluyó en 2017, confirmado en un seguimiento de 2024, que no hace falta fijar una IDA numérica y que no hay preocupación de seguridad para la población general con los usos autorizados.",
    "flags": ["fibra-molestias-digestivas"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica para la goma guar (E 412) y que no hay preocupación de seguridad para la población general con la evaluación de exposición refinada a los usos declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11070944/"},
    ],
}
REVISIONES["E415"] = {
    "risk": "low",
    "description": "Espesante obtenido por fermentación bacteriana. La EFSA concluyó en 2017 que no hace falta fijar una IDA numérica y que no hay preocupación de seguridad con los usos autorizados; un seguimiento de 2023 confirmó lo mismo para alimentos de uso médico especial en lactantes.",
    "flags": ["fibra-efecto-laxante"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica para la goma xantana (E 415) y que no hay preocupación de seguridad con la evaluación de exposición refinada a los usos declarados; esta reevaluación no cubre a los lactantes menores de 12 semanas.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009887/"},
    ],
}

# --- Riesgo bajo, segunda mitad (E418, E420, E421*, E471, E472e, E476,
#     E481*, E491, E620, E621, E903*, E904, E960, E965*, E967*) ------------
# * = sin resolver esta tanda. E481 y E903 son el bloqueo de siempre (Wiley
#     403, sin PMC). E421, E965 y E967 tienen reevaluación EFSA en curso
#     dentro del programa de edulcorantes/polioles, pero no verifiqué cada
#     uno por separado (sólo abrí la llamada de datos específica del E420) y
#     no quiero extender por analogía sin comprobarlo.
#
# Dos subidas importantes esta tanda: E620/E621 (glutamatos) y E960
# (esteviol). En ambos casos no es una alarma inventada, es lo que dice el
# propio dictamen EFSA que abrí: la exposición actual, con los usos ya
# autorizados, ya supera el umbral de referencia en niños pequeños.

REVISIONES["E418"] = {
    "risk": "low",
    "description": "Gelificante obtenido por fermentación. La EFSA concluyó en 2018 que no hace falta una IDA numérica y que no hay preocupación de seguridad con la evaluación de exposición refinada a los usos declarados.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2018,
         "finding": "El Panel concluye que no hace falta una IDA numérica para la goma gellan (E 418) y que no hay preocupación de seguridad con la evaluación de exposición refinada a los usos y niveles de uso declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009714/"},
    ],
}
REVISIONES["E420"] = {
    "risk": "low",
    "description": "Poliol edulcorante. Por encima de 10 g al día produce efecto laxante, de ahí la advertencia obligatoria en el etiquetado. La EFSA todavía no ha publicado su reevaluación completa: en 2023 pidió un ensayo de micronúcleo in vitro actualizado porque los estudios de genotoxicidad disponibles son anteriores a las directrices OCDE vigentes.",
    "flags": ["efecto-laxante", "reevaluacion-efsa-en-curso"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2023,
         "finding": "La EFSA solicita un ensayo de micronúcleo in vitro sobre el sorbitol (E 420 i), siguiendo la versión más reciente de la directriz OCDE TG 487, porque los estudios de genotoxicidad disponibles carecen de un ensayo de micronúcleo in vitro plenamente fiable según los estándares actuales.",
         "url": "https://www.efsa.europa.eu/en/call/call-data-genotoxicity-data-sorbitol-e-420-i"},
    ],
}
REVISIONES["E471"] = {
    "risk": "low",
    "description": "El emulgente más usado en bollería industrial. La EFSA concluyó en 2017 que no hace falta una IDA numérica y que no supone un problema de seguridad a los niveles de uso declarados: se hidroliza en el tracto digestivo liberando glicerol y ácidos grasos, ambos ya evaluados como seguros.",
    "flags": ["marcador-ultraprocesado"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica y que los mono y diglicéridos de ácidos grasos (E 471) no suponen un problema de seguridad a los niveles de uso declarados; se hidrolizan liberando glicerol y ácidos grasos, previamente evaluados como seguros.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010209/"},
    ],
}
REVISIONES["E472e"] = {
    "risk": "low",
    "description": "Mejorante de panificación industrial (DATEM). La EFSA fijó en 2020 una IDA de 600 mg/kg de peso corporal al día, ligada a la IDA de grupo de los tartratos, y concluyó que no hay preocupación de seguridad a los niveles de uso declarados; se hidroliza liberando ácidos grasos, glicerol y ácido tartárico.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "600 mg/kg de peso corporal al día, como ácido tartárico (EFSA, 2020)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2020,
         "finding": "El Panel establece una IDA de 600 mg/kg pc/día para el E 472e, expresada como ácido tartárico, ligada a la IDA de grupo de los tartratos; no hay preocupación de seguridad a los niveles de uso declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7448088/"},
    ],
}
REVISIONES["E476"] = {
    "risk": "low",
    "description": "Reduce la viscosidad del chocolate y permite usar menos manteca de cacao. La EFSA elevó en 2017 la IDA de 7,5 a 25 mg/kg de peso corporal al día; un seguimiento de 2022 confirmó que la exposición no la supera en ningún escenario y que la extensión de uso propuesta tampoco supondría un problema de seguridad, aunque pidió revisar los límites de arsénico en las especificaciones.",
    "flags": ["marcador-ultraprocesado"],
    "efsaAdi": "25 mg/kg de peso corporal al día (EFSA, 2017; antes 7,5 mg/kg)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2022,
         "finding": "En ninguno de los escenarios la exposición supera la IDA de 25 mg/kg pc/día para el E 476; la extensión de uso propuesta, de autorizarse, tampoco supondría un problema de seguridad. El Panel señala que el margen de exposición al arsénico calculado en el extremo inferior del rango es insuficiente, y pide revisar las especificaciones.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9066526/"},
    ],
}
REVISIONES["E491"] = {
    "risk": "low",
    "description": "Emulgente sintético del grupo de los ésteres de sorbitano (E491-E495). La EFSA estableció en 2017 una IDA de grupo de 10 mg/kg de peso corporal al día, expresada como sorbitano, y concluyó que la exposición no la supera en ningún grupo de población.",
    "flags": [],
    "efsaAdi": "10 mg/kg de peso corporal al día, como sorbitano (IDA de grupo E491-E495, EFSA 2017)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel deriva una IDA de grupo de 10 mg/kg pc/día, expresada como sorbitano, para los ésteres de sorbitano (E 491-E495); la exposición media y la del percentil 95, en el escenario no fiel a una marca, no superan la IDA en ningún grupo de población.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010202/"},
    ],
}

_GLUTAMATOS_EVIDENCE = [
    {"body": "EFSA", "type": "dictamen", "year": 2017,
     "finding": "El Panel establece una IDA de grupo de 30 mg/kg de peso corporal al día, expresada como ácido glutámico, para el ácido glutámico y los glutamatos (E 620-E625). Señala que la exposición supera no solo la IDA propuesta, sino también las dosis asociadas al «síndrome MSG» en humanos (>42,9 mg/kg pc/día) en parte de la población.",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009848/"},
    {"body": "EFSA", "type": "dictamen", "year": 2017,
     "finding": "En el escenario no fiel a una marca, la exposición media ya supera la dosis asociada al síndrome MSG en niños pequeños y niños, y la exposición del percentil 95 la supera en lactantes, niños pequeños, niños y adolescentes.",
     "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009848/"},
]
_GLUTAMATOS_ADI = "IDA de grupo: 30 mg/kg de peso corporal al día, como ácido glutámico (EFSA, 2017); superada en niños pequeños y niños incluso en la exposición media"
_GLUTAMATOS_FLAGS = ["ida-superada-sindrome-msg", "marcador-ultraprocesado"]

REVISIONES["E620"] = {
    "risk": "moderate",
    "description": "Aminoácido presente de forma natural en muchos alimentos; como aditivo, marcador de ultraprocesado. La EFSA fijó en 2017 una IDA de grupo de 30 mg/kg de peso corporal al día para el conjunto de glutamatos (E 620-E625), pero señaló que la exposición real ya supera, en niños pequeños y niños, las dosis asociadas al «síndrome del restaurante chino» (síndrome MSG) descrito en humanos.",
    "flags": _GLUTAMATOS_FLAGS,
    "efsaAdi": _GLUTAMATOS_ADI,
    "evidence": _GLUTAMATOS_EVIDENCE,
}
REVISIONES["E621"] = {
    "risk": "moderate",
    "description": "Potenciador del sabor y marcador de ultraprocesado. Comparte con el resto de glutamatos (E 620-E625) la IDA de grupo de 30 mg/kg de peso corporal al día que fijó la EFSA en 2017; la exposición real ya supera, en niños pequeños y niños, las dosis asociadas al síndrome MSG descrito en humanos, y en adolescentes en el percentil 95 de consumo.",
    "flags": _GLUTAMATOS_FLAGS,
    "efsaAdi": _GLUTAMATOS_ADI,
    "evidence": _GLUTAMATOS_EVIDENCE,
}
REVISIONES["E904"] = {
    "risk": "low",
    "description": "Resina de origen animal usada como agente de recubrimiento brillante. La EFSA fijó en 2024 una IDA de 4 mg/kg de peso corporal al día para la goma laca sin cera producida por decoloración física (la variante decolorada químicamente tiene una IDA temporal, pendiente de datos sobre impurezas organocloradas). Aunque el cálculo teórico supera la IDA en el percentil 95 de algunos grupos de edad, la EFSA concluye explícitamente que ese exceso no indica preocupación de seguridad real, por ser una estimación conservadora.",
    "flags": ["no-vegano"],
    "efsaAdi": "4 mg/kg de peso corporal al día para la variante sin cera (EFSA, 2024); temporal para la variante decolorada químicamente",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2024,
         "finding": "El Panel fija una IDA de 4 mg/kg pc/día para la goma laca sin cera producida por decoloración física. Aunque el cálculo supera la IDA en el percentil 95 de varios grupos de edad, concluye que ese exceso calculado no indica preocupación de seguridad, al ser conservadoras tanto la estimación de exposición como la evaluación toxicológica.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11292212/"},
    ],
}
REVISIONES["E960"] = {
    # CAMBIO DE CLASIFICACIÓN: sube de "low" a "moderate". No es la extensión
    # de uso propuesta (que la EFSA rechazó): es que, con los usos YA
    # autorizados, la exposición en niños pequeños en el percentil 95 ya
    # supera la IDA actual.
    "risk": "moderate",
    "description": "Extracto purificado de la hoja de estevia. La IDA es de 4 mg/kg de peso corporal al día, como esteviol. Un dictamen de 2024 que evaluaba una posible ampliación de uso la mantuvo sin cambios porque, incluso con los usos YA autorizados hoy, la exposición del percentil 95 en niños pequeños alcanza 4,8 mg/kg pc/día, por encima de la IDA; ampliar el uso agravaría esa superación.",
    "flags": ["ida-superada-ninos-percentil-95"],
    "efsaAdi": "4 mg/kg de peso corporal al día, como esteviol (sin cambios; superada en niños pequeños con los usos actuales)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2024,
         "finding": "El Panel concluye que no hay justificación suficiente para subir la IDA de 4 mg/kg pc/día. Con los usos ya autorizados, la exposición del percentil 95 en niños pequeños alcanza 4,8 mg/kg pc/día, ya por encima de la IDA; con la extensión de uso propuesta llegaría a 6,9 mg/kg pc/día.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11533382/"},
    ],
}

# --- Riesgo cero: parte resuelta de la Tanda 8 (42 aditivos, "los que
#     quedan") -------------------------------------------------------------
# Objetivo de esta tanda según el encargo: no buscar problemas, poder decir
# "lo miré" con fecha. La mayoría de lo comprobado lo confirma. Pero salieron
# tres excepciones reales, no presunciones: E100, E170 y, sobre todo, E422
# (los "slush", ver más abajo). Es justo el caso que avisa la sección de
# trampas: no descartar una alarma sólo porque la tanda se llame "riesgo
# cero"; comprobarla como cualquier otra.
#
# De los 42 de la tanda, sólo se resuelven aquí 11. El resto (E101, E140,
# E150a, E160c, E161b, E162, E163, E260, E270, E290, E296, E300, E301, E306,
# E307, E325, E330, E331, E333, E334, E401, E410, E460, E500, E501, E503,
# E504, E524, E575, E901, E920) se queda sin tocar por límite de tiempo, no
# porque haya nada raro en ellos: en los casos donde llegué a ver algo (p.
# ej. E140, con vacíos de datos parecidos a los de E141), no encontré una
# fuente que pudiera abrir de verdad para citarla.

REVISIONES["E100"] = {
    # CAMBIO DE CLASIFICACIÓN: sube de "none" a "moderate". La EFSA fijó la
    # IDA en 2010, pero un informe posterior de exposición refinada encontró
    # que, en algunas encuestas, niños pequeños y niños ya la superan.
    "risk": "moderate",
    "description": "Colorante amarillo-naranja extraído de la cúrcuma. La EFSA fijó en 2010 una IDA de 3 mg/kg de peso corporal al día. Un informe posterior de exposición refinada encontró que, en algunas encuestas nacionales, la estimación de ingesta alta en niños pequeños y niños llega a igualar o superar esa IDA.",
    "flags": ["ida-superada-ninos-alguna-encuesta"],
    "efsaAdi": "3 mg/kg de peso corporal al día (EFSA, 2010); igualada o superada en niños pequeños y niños en algunas encuestas",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2014,
         "finding": "Las estimaciones de ingesta alta estuvieron al nivel de la IDA en niños pequeños y niños, con superación de la IDA en una encuesta de cada uno de esos dos grupos de población.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13136989/"},
    ],
}
REVISIONES["E170"] = {
    # CAMBIO DE CLASIFICACIÓN: sube de "none" a "moderate". No es el
    # carbonato de calcio en sí: es el aluminio que puede arrastrar como
    # impureza a los niveles de especificación actuales.
    "risk": "moderate",
    "description": "Fuente de calcio autorizada como aditivo, sin problema de seguridad por el carbonato de calcio en sí mismo. El problema es el aluminio que puede contener como impureza: con los límites de especificación actuales, la EFSA calcula que la exposición a aluminio puede llegar a superar hasta unas 4 veces la ingesta semanal tolerable en varios grupos de población, y pide que se revisen esos límites.",
    "flags": ["impureza-aluminio-supera-limite"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2023,
         "finding": "No hace falta una IDA numérica para el carbonato de calcio y no hay preocupación de seguridad por la sustancia en sí. Pero la presencia inevitable de aluminio es motivo de preocupación: con los límites de especificación propuestos, la exposición a aluminio por esta vía supera sustancialmente (hasta unas 4 veces) la ingesta semanal tolerable en varios grupos de población.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10373136/"},
    ],
}
REVISIONES["E234"] = {
    "risk": "low",
    "description": "Bacteriocina producida por fermentación, se digiere como una proteína más. La EFSA elevó en 2017 la IDA de 0,13 a 1 mg de nisina A/kg de peso corporal al día y concluyó que la extensión de uso propuesta no supone un problema de seguridad. El propio Panel señaló que la posible inducción de resistencia antimicrobiana quedaba fuera del alcance de esa evaluación toxicológica y recomendó valorarla por separado.",
    "flags": ["resistencia-antimicrobiana-no-evaluada"],
    "efsaAdi": "1 mg de nisina A/kg de peso corporal al día (EFSA, 2017; antes 0,13 mg/kg)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel eleva la IDA a 1 mg de nisina A/kg pc/día y concluye que la extensión de uso propuesta en queso no curado y productos cárnicos tratados con calor no supone un problema de seguridad; recomienda evaluar por separado, fuera de esta valoración toxicológica, el riesgo de inducir resistencia antimicrobiana.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009836/"},
    ],
}
REVISIONES["E322"] = {
    "risk": "none",
    "description": "Emulgente extraído de la soja, el girasol u otras semillas oleaginosas; es un constituyente natural del propio cuerpo humano. La EFSA concluyó en 2017 que no hace falta una IDA numérica y que no hay preocupación de seguridad para la población general a partir de un año de edad, con la evaluación de exposición refinada a los usos declarados.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica para las lecitinas (E 322) y que no hay preocupación de seguridad para la población general a partir de un año de edad, con la evaluación de exposición refinada a los usos declarados.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010002/"},
    ],
}
REVISIONES["E406"] = {
    "risk": "none",
    "description": "Gelificante de algas rojas, mínimamente absorbido y apenas fermentado por la microbiota intestinal. La EFSA concluyó en 2016 que no hace falta una IDA numérica y que no hay preocupación de seguridad para la población general con los usos declarados.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2016,
         "finding": "El Panel concluye que no hace falta una IDA numérica para el agar (E 406) y que no hay preocupación de seguridad para la población general con la evaluación de exposición refinada a los usos declarados; no se observó genotoxicidad ni efectos adversos hasta las dosis más altas ensayadas.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13088875/"},
    ],
}
REVISIONES["E414"] = {
    "risk": "none",
    "description": "Goma extraída de la savia de la acacia. La EFSA concluyó en 2017 que no hace falta una IDA numérica y que no hay preocupación de seguridad con los usos declarados; en dosis muy altas (hasta 30 g al día) puede producir flatulencia leve, considerada molesta pero no un efecto adverso.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica para la goma arábiga (E 414) y que no hay preocupación de seguridad con la evaluación de exposición refinada a los usos declarados; la tolerancia en humanos llega hasta 30 g al día, con flatulencia leve en algunos casos, considerada molesta pero no adversa.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010027/"},
    ],
}
REVISIONES["E422"] = {
    # CAMBIO DE CLASIFICACIÓN: sube de "none" a "moderate". Este es el
    # hallazgo más importante de la Tanda 8, y llega de un dictamen EFSA muy
    # reciente (2026) que evaluaba específicamente las bebidas "slush"
    # heladas. No es un problema del glicerol como aditivo en general: es un
    # problema de exposición aguda muy concentrada en un único producto.
    "risk": "moderate",
    "description": "Aditivo autorizado sin problema de IDA crónica: la EFSA no considera necesario fijar un límite numérico para el uso habitual. Pero un dictamen de 2026 centrado en las bebidas «slush» heladas encontró que, por el consumo de una sola bebida, la exposición aguda al glicerol supera la dosis de referencia aguda (125 mg/kg de peso corporal) en TODOS los grupos de población, con concentraciones en el producto de hasta 33.100-52.900 mg/kg. La EFSA recomienda que la Comisión fije límites máximos de glicerol en bebidas.",
    "flags": ["exposicion-aguda-slush-supera-arfd"],
    "efsaAdi": "Sin IDA crónica numérica; dosis de referencia aguda (ARfD) de 125 mg/kg de peso corporal, superada por el consumo de bebidas «slush» (EFSA, 2026)",
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2026,
         "finding": "La exposición aguda al glicerol por el consumo de una sola bebida «slush» helada superaría la dosis de referencia aguda (ARfD de 125 mg/kg pc) en todos los grupos de población, con concentraciones de glicerol en el producto de 33.100 a 52.900 mg/kg. El Panel recomienda a la Comisión Europea estudiar el establecimiento de niveles máximos numéricos de glicerol (E 422) en bebidas.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13140524/"},
    ],
}
REVISIONES["E440"] = {
    "risk": "none",
    "description": "Fibra gelificante natural presente en frutas y verduras, extraída sobre todo de cítricos y manzana. La EFSA concluyó en 2017 que no hace falta una IDA numérica y que no hay preocupación de seguridad para la población general con los usos declarados.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel concluye que no hace falta una IDA numérica para la pectina (E 440i) ni para la pectina amidada (E 440ii), y que no hay preocupación de seguridad para la población general; la exposición estimada, incluso en el escenario más alto en niños pequeños (hasta 442 mg/kg pc/día), no genera preocupación.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010145/"},
    ],
}
REVISIONES["E509"] = {
    "risk": "none",
    "description": "Sal mineral usada como firmeza en conservas de fruta y verdura. La EFSA confirmó en 2019, junto con el resto de cloruros (E507, E508, E511), la IDA «no especificada» y concluyó que no hay preocupación de seguridad con los usos declarados.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2019,
         "finding": "La exposición al cloruro procedente del ácido clorhídrico y sus sales de potasio, calcio y magnesio (E 507, E 508, E 509 y E 511) no plantea preocupación de seguridad a los niveles de uso declarados; se confirma la IDA «no especificada».",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009240/"},
    ],
}
REVISIONES["E570"] = {
    "risk": "none",
    "description": "Ácidos grasos, entre ellos el ácido esteárico, usados como antiaglomerante y agente de recubrimiento. La EFSA concluyó que no hay preocupación de seguridad con los usos declarados; la exposición por esta vía representa alrededor de un 1% del total de ácidos grasos saturados de la dieta.",
    "flags": [],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2017,
         "finding": "El Panel mantiene la IDA «no especificada» y concluye que los ácidos grasos (E 570) no suponen un problema de seguridad a los niveles de uso declarados; la exposición por esta vía es aproximadamente el 1% de la exposición total a ácidos grasos saturados de todas las fuentes de la dieta.",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7009963/"},
    ],
}
REVISIONES["E160a"] = {
    "risk": "low",
    "description": "Carotenos mixtos y betacaroteno, usados como colorante naranja. La EFSA no pudo fijar una IDA numérica en 2012 por especificaciones inadecuadas y datos toxicológicos limitados, pero concluyó que su uso como colorante no supone un problema de seguridad siempre que la ingesta total por esta vía y por complementos no supere lo que se ingeriría con una dieta normal rica en estos pigmentos (5-10 mg al día).",
    "flags": ["ida-no-establecida-datos-limitados"],
    "evidence": [
        {"body": "EFSA", "type": "dictamen", "year": 2012,
         "finding": "Con los datos disponibles no puede establecerse una IDA para los carotenos mixtos y el betacaroteno. Su uso como colorante alimentario no supone un problema de seguridad siempre que la ingesta por esta vía y por complementos no supere la cantidad que se ingeriría con el consumo habitual de los alimentos donde se encuentran de forma natural (5-10 mg al día).",
         "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC13151842/"},
    ],
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
