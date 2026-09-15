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
