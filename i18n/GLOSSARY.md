# Spanish glossary and style (neutral Latin American Spanish)

Read by whoever translates `i18n/es.json`. The dictionary maps an English KEY to its
translation; see `i18n/engine.ts` for how keys and `{0}` placeholders work.

## Rules
- Neutral Latin American Spanish: no vosotros, no regional slang. Address the player as **tú**
  (imperatives: "Llena el recipiente", not "Llene"). Mr. Master writes to the player as tú.
- **Placeholders** `{0}`, `{1}`… must appear in the translation exactly as many times as in the key.
  They may be reordered. Never put gender- or number-dependent words right against one
  ("{0} lotes" is fine only if the key already says "batches"); prefer wording that works for
  any value ("Lotes: {0}"; "fermento láctico de {0}").
- Keep the key's **shape**: a fragment with no capital and no final full stop stays one
  (the game joins fragments into sentences: "too hot for anything to establish" -> "demasiado
  caliente para que algo se establezca"). Keep em dashes, "·", "%", "$", units (kg, g, L, °C), digits.
- **Short UI text stays short** (buttons, tabs, labels: no more than ~30% longer than English).
- Keep fermentation loanwords as they are: koji, miso, garum, colatura, kimchi, tempeh, natto, kombucha,
  SCOBY, shoyu, tamari, sake, onggi, cheong, meju, doenjang, bottarga, katsuobushi, salumi, nuoc mam, kvas (kvass).
- **Proper names stay**: suppliers (Nordic Staples Co., Prime Sourcing Ltd., Silk Road Imports, BioLab Cultures,
  Hedge & Understory), cultivar and breed names (Kingston Black, Yamada Nishiki, Jersey), people. Translate the common
  noun inside them ("Victoria Plum" -> "Ciruela Victoria"). "Mr. Master" -> "el Sr. Master" (just "Sr. Master" in a signature).
- Accents and ¿ ¡ are required. Write real characters, not escapes.

## Terms
| English | Spanish |
|---|---|
| ferment (n.) / fermented / fermentation | fermento / fermentado / fermentación |
| lacto-fermented / lacto ferment | lactofermentado / fermento láctico |
| culture (microbial) / starter | cultivo / iniciador (cultivo iniciador) |
| spores / mould / strain / lineage | esporas / moho / cepa / linaje |
| sporulate / sporulation | esporular / esporulación |
| koji bed / tray / chamber | lecho de koji / bandeja / cámara |
| brine / salinity / pickle | salmuera / salinidad / encurtido |
| vessel / jar / crock / cask / barrel | recipiente / frasco / vasija / barrica / barril |
| Mason Jar | Frasco de vidrio |
| bench (workbench) | banco (de trabajo) |
| batch / yield / score | lote / rendimiento / puntuación |
| tasting notes / post-mortem | notas de cata / postmortem |
| harvest (a batch) / keep / sell / discard | cosechar / guardar / vender / descartar |
| cellar / cellared | bodega / en bodega |
| pantry / supply / hardware / staff / orders | despensa / suministros / equipo / personal / pedidos |
| codex / estate / the town / the wild | códice / finca / el pueblo / lo silvestre |
| hygiene / inspector / renown / standing | higiene / inspector / renombre / trato (con un proveedor) |
| heat (inspector's attention) | vigilancia |
| heat (temperature control) | calor |
| vendor / buyer / supplier / contract | comprador / comprador / proveedor / contrato |
| fence (black market) / underground / contraband | intermediario / mercado clandestino / contrabando |
| tier / level / skill / experience | nivel / nivel / habilidad / experiencia |
| substrate / reagent / additive / ingredient | sustrato / reactivo / aditivo / ingrediente |
| protease / amylase / lipase | proteasa / amilasa / lipasa |
| umami / acidity / funk / sweetness / safety | umami / acidez / funk / dulzor / seguridad |
| peak window / ready / spoiled / sealed | ventana de punto óptimo / listo / echado a perder / sellado |
| inoculate / intervention | inocular / intervención |
| Stir / Skim / Turn / Flip / Vent / Mist / Clean | Remover / Espumar / Voltear / Voltear / Ventilar / Nebulizar / Limpiar |
| Press / Filter | Prensar / Filtrar |
| ticks | ciclos |
| Spring / Summer / Autumn / Winter | Primavera / Verano / Otoño / Invierno |
| months (Jan…Dec, short) | Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic |
| weekdays | lunes martes miércoles jueves viernes sábado domingo (capitalised if the key is) |
| plot / bed (garden) / orchard / field / tunnel | parcela / bancal / huerto frutal / campo / túnel |
| hens / bees / hive / shed | gallinas / abejas / colmena / cobertizo |
| compost / soil / worms | compost / suelo / lombrices |
| sauerkraut / vinegar / mead / cider / whey | chucrut / vinagre / hidromiel / sidra / suero |
| fish sauce / amino sauce | salsa de pescado / salsa de aminoácidos |
| yoghurt / butter / cream / cheese | yogur / mantequilla / crema / queso |
| black garlic | ajo negro |
| forager / forage | recolector / recolectar |
