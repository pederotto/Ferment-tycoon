# Pantry pack — what was checked, what was added

Added 29–30 Sep 2026 from the heirloom/ancient recipe list. The recipes and ingredients live in `index.html` (the game script line); `pantry-pack.js` in this folder is a readable copy of that block, for porting into the game source project. The art is embedded in `index.html` as well (section 4).

## 1. Already in the game

Checked against the 88 recipes and ~340 ingredients that were there. These were **not** re-added; where the list had swap-ins or sensory notes the game lacked, those were added to the existing recipe.

| Your recipe | In the game as | What was added |
|---|---|---|
| Baechu Kimchi | `kimchi` (Kimchi) | Michihili, Wong Bok, January King, Cavolo Nero; Korean mu, watermelon and Black Spanish radish; saeujeot and anchovy aekjeot; 6 chillies (Yeongyang, Kashmiri, Urfa, Aleppo, Espelette, Chiltepin); fresh / ripe / aged notes |
| Fermented Tomatoes (green and ripe) | `lacto_tomato` (Whole Lacto-Tomatoes) | Cherokee Purple, Black Krim, Brandywine, Green Zebra, Costoluto Genovese and San Marzano were already there. Added Aunt Ruby's German Green, Pineapple, Principe Borghese, Piennolo, Currant tomato, Yellow Pear, tomatillo, ground cherry; green vs ripe notes |
| Shio Koji | `shio_koji` | Notes only |
| Koji substrates | `heritage_koji`, `grain_sake` | Einkorn, emmer, Khorasan (kamut), Hopi Blue, Bloody Butcher, Oaxacan Green, Glass Gem were already there. Added Koshihikari, Yamada Nishiki, Carolina Gold, Forbidden black, Bhutanese red, Bere barley, naked barley, Red Fife, Turkey Red, Cherokee White Eagle |
| Miso, white and red | `shiro_miso`, `hatcho_miso`, `bean_miso` | Tamba kuromame (a real soybean, so it also works in tamari, tempeh, natto), Carlin, Black Badger, Martock, Aquadulce, adzuki, Anasazi, Christmas lima; white / red notes. Black beluga lentils and chickpeas were already there |
| Shoyu | `moromi`, `tamari` | Tamba kuromame; notes. **Not done:** the heritage-wheat swap (Red Fife, emmer). The shoyu rule asks for the plain Roasted Wheat item, and I did not add roasted heritage wheats |
| Apple Cider Vinegar | `cider_vinegar` | 15 heritage apples now accepted; notes |
| Apple Cider Black Butter | `black_apple` (Blackened Fruit) | Same process. Heritage apples and the new plums now accepted; notes |
| Black-garlic swaps | `black_garlic` | Rocambole, Chesnok Red, Georgian Crystal, Music, Creole |

Two near-misses that were treated as **new** because they are genuinely different dishes: `Brined Green Plums` (unripe plums in a light brine) vs **Lacto Plums** (ripe plums, umeboshi-like); and `Hazelnut Miso` (miso *made from* nuts) vs **Miso Hazelnuts** (nuts *coated in* miso). `Cultured Cream` is a different thing from **Koji-Cultured Butter**.

## 2. New recipes (23)

Each is found the way the others are: put the right substrate, additives and vessel together, and analyse the result. **Substrate** is what goes in first; **also needs** is what must be in the vessel.

| Recipe | Type | Vessel | Substrate accepted | Also needs | Must not contain |
|---|---|---|---|---|---|
| **Autumn Hobak Kimchi** (`hobak_kimchi`) | Lacto | Onggi | Any winter or summer squash | chilli, salt | — |
| **Fermented Wild Garlic** (`wild_garlic_ferment`) | Lacto | Glass Jar | Wild garlic, ramps or wild leek | salt | sugar, live koji, spores |
| **Quick Fermented Relish** (`quick_relish`) | Lacto | Glass Jar | A tomato or a sweet pepper | a fresh herb, salt | live koji, spores, sugar |
| **Lacto Plums** (`lacto_plums`) | Lacto | Glass Jar | Any ripe plum | salt | sugar, live koji, spores |
| **Lacto Apples** (`lacto_apples`) | Lacto | Glass Jar | Any apple | salt | sugar, live koji, spores, water |
| **Wasabina Mustard Greens** (`wasabina_greens`) | Lacto | Onggi | Mustard greens | salt | sugar, live koji, spores |
| **Kanji** (`kanji`) | Lacto | Glass Jar | Any carrot | salt, water | sugar, live koji, spores |
| **Black Boshi** (`black_boshi`) | Miso/Paste | Onggi | Currants or dark berries | salt | water, sugar, live koji, spores |
| **Honey Fermented Garlic** (`honey_garlic`) | Lacto | Glass Jar | Any garlic | honey | salt, live koji, spores, scoby |
| **Fruit Cheong** (`fruit_cheong`) | Alcoholic | Glass Jar | Persimmon, rosehip or blackcurrant | sugar | water, salt, live koji |
| **Gotgam** (`gotgam`) | Miso/Paste | Cedar Tray | Any persimmon | — | salt, sugar, water, live koji, spores |
| **Koji Ketchup** (`koji_ketchup`) | Miso/Paste | Glass Jar | A heirloom tomato | live koji, sugar | salt, water |
| **Koji-Cultured Butter** (`koji_butter`) | Lacto | Glass Jar | Cream or whole milk | live koji | salt, water |
| **Miso Hazelnuts** (`miso_hazelnuts`) | Miso/Paste | Glass Jar | Any nut | a miso | live koji, spores, water |
| **Black Chilli** (`black_chilli`) | Blackening | Thermal Chamber | Whole dried chillies | — | salt, sugar, water, live koji |
| **Persimmon Vinegar** (`persimmon_vinegar`) | Vinegar | Cedar Barrel | Any persimmon | water | scoby, honey, sugar, salt, live koji |
| **Oxymel** (`oxymel`) | Vinegar | Glass Jar | Meadowsweet or another flower | honey, a vinegar | salt, live koji |
| **Ginger Beer** (`ginger_beer`) | Alcoholic | Glass Jar | Ginger, turmeric or galangal | sugar, water | scoby, salt, honey |
| **Wild Soda** (`wild_soda`) | Alcoholic | Glass Jar | Elderberry, rhubarb or sumac | sugar, water | scoby, salt, honey |
| **Fermented Verbena Tea** (`verbena_tea`) | Lacto | Glass Jar | Lemon verbena, balm, grass or myrtle | — | salt, sugar, honey, live koji, spores, scoby, water |
| **Farmhouse Seidr** (`seidr`) | Alcoholic | Oak Cask or Cedar Barrel | Any apple | — | water, salt, sugar, honey, live koji, spores, scoby |
| **Sowens** (`sowens`) | Lacto | Onggi or Glass Jar | Any oats | water | salt, live koji, spores, sugar |
| **Yoghurt and Kefir Cheese** (`yoghurt_kefir`) | Lacto | Glass Jar | Any milk | a milk culture | salt, p_roqueforti, larvae, live koji |

## 3. New ingredients (177)

Every heirloom swap-in is its own ingredient with its own stats and a one-line effect in its description. All are sold by an existing supplier (Nordic, Silk Road, Prime, BioLab, Hedge & Understory) at the same tier gates as the rest of the shelf, and seasonal produce is only in season in its own months. Until art is added they show the game's stock icon.

## 4. Art

Eight sprite sheets of 30 pictures each (6 columns × 5 rows) came in through Plate Drop on 29 Sep 2026. The originals are kept in `sheets/sheet1.jpg` to `sheet8.jpg` (1 vegetables, 2 fruit and tomatoes, 3 grains, beans, nuts and sweeteners, 4 chillies, herbs, dairy and cultures, 5 lacto ferments, 6 koji, miso and sweet ferments, 7 drinks, vinegars, dairy and grains, 8 equipment and icons), so any of them can be cut again.

Each picture was cut out of the magenta, its centre found and scaled to a 128 px square, and the caption text burned into sheet 2 (rows 3–5) was erased. They are stored as two transparent sheets embedded in `index.html` (`PANTRY_ING_SHEET`, `PANTRY_PRODUCT_SHEET`) and matched by id. **They only fill gaps:** an item that already had painted art (Cherokee Purple, Black Krim, Hopi Blue, einkorn, chickpeas, kimchi, sauerkraut and so on) keeps it.

### Wired in: 98 ingredient icons

`michihili`, `january_king`, `cavolo_nero`, `mu_radish`, `beauty_heart_radish`, `black_spanish_radish`, `aehobak`, `red_kuri`, `blue_hubbard`, `musquee_de_provence`, `purple_black_carrot`, `orange_carrots`, `chioggia_beet`, `beetroot`, `jimmy_nardello`, `padron`, `wild_garlic`, `ramps`, `three_cornered_leek`, `red_giant_mustard`, `osaka_purple_mustard`, `garlic_mustard`, `chesnok_red`, `creole_garlic`, `elephant_garlic`, `ginger_root`, `turmeric_root`, `blue_ring_ginger`, `aunt_rubys_german_green`, `pineapple_tomato`, `piennolo`, `currant_tomato`, `tomatillo`, `ground_cherry`, `nanko_ume`, `damson`, `greengage`, `mirabelle`, `sloe`, `cox_orange_pippin`, `roxbury_russet`, `bramley`, `crab_apples`, `kingston_black`, `hachiya_persimmon`, `fuyu_persimmon`, `bergamot_zest`, `blackcurrants`, `redcurrants`, `whitecurrants`, `aronia`, `elderberries`, `dog_rose_hips`, `koshihikari`, `carolina_gold`, `forbidden_rice`, `bhutanese_red_rice`, `bere_barley`, `red_fife`, `bristle_oat`, `black_tartarian_oat`, `tamba_black_soybeans`, `carlin_peas`, `martock_beans`, `adzuki_beans`, `tonda_gentile`, `walnuts`, `chestnuts`, `heather_honey`, `soba_honey`, `acacia_honey`, `muscovado_sugar`, `jaggery_sugar`, `gochugaru_yeongyang_chili`, `kashmiri_chili`, `urfa_chili`, `espelette_pepper`, `chiltepin_chili`, `chilhuacle_negro`, `scotch_bonnet`, `aji_amarillo`, `genovese_basil`, `thai_basil`, `coriander_leaf`, `lovage`, `lemon_verbena`, `meadowsweet`, `elderflower`, `linden_blossom`, `sweet_woodruff`, `red_shiso`, `black_mustard_seed`, `jersey_milk`, `goat_milk`, `sheep_milk`, `buffalo_milk`, `kefir_starter`, `saeujeot`

### Wired in: 24 product icons

All 23 new recipes, plus `shio_koji_jar`, which had no picture before: `hobak_kimchi_jar`, `wild_garlic_jar`, `relish_jar`, `lacto_plum_jar`, `lacto_apple_jar`, `wasabina_jar`, `kanji_jar`, `shio_koji_jar`, `koji_ketchup_jar`, `koji_butter_block`, `miso_hazelnut_jar`, `black_boshi_jar`, `honey_garlic_jar`, `fruit_cheong_syrup`, `gotgam_string`, `black_chilli_jar`, `persimmon_vinegar_bottle`, `oxymel_bottle`, `ginger_beer_bottle`, `wild_soda_bottle`, `verbena_tea_jar`, `seidr_cask`, `sowens_crock`, `yoghurt_jar`

### New ingredients still without a picture (80)

They show the game's stock icon until a picture is added: Wong Bok (`wong_bok`), Anchovy Aekjeot (`aekjeot`), Aleppo Chilli (`aleppo_chili`), Kabocha (`kabocha`), Rouge Vif d'Etampes (`rouge_vif_detampes`), Seminole Pumpkin (`seminole_pumpkin`), Long Island Cheese Pumpkin (`long_island_cheese`), Chinese Garlic Chives (`chinese_garlic_chives`), Wild Garlic Buds (`wild_garlic_buds`), Corno di Toro (`corno_di_toro`), Greek Bush Basil (`greek_basil`), Meyer Lemon Zest (`meyer_lemon_zest`), Victoria Plum (`victoria_plum`), Italian Prune Plum (`prune_plum`), Cherry Plum (`cherry_plum`), Egremont Russet (`egremont_russet`), Esopus Spitzenburg (`esopus_spitzenburg`), Bardsey Apple (`bardsey_apple`), Malus sieversii (`sieversii_apple`), Dabinett (`dabinett`), Yarlington Mill (`yarlington_mill`), Foxwhelp (`foxwhelp`), Harrison Apple (`harrison_apple`), Hewe's Crab (`hewes_crab`), Wasabina (`wasabina`), Green Wave (`green_wave_mustard`), Takana (`takana`), Afghan Purple Carrot (`afghan_purple_carrot`), Cosmic Purple (`cosmic_purple_carrot`), Brown Mustard Seed (`brown_mustard_seed`), Jostaberry (`jostaberry`), Gooseberry (Whinham's Industry) (`gooseberry_whinhams`), Rocambole Garlic (`rocambole_garlic`), Georgian Crystal (`georgian_crystal`), Music Garlic (`music_garlic`), Chestnut Honey (`chestnut_honey`), Manuka Honey (`manuka_honey`), Lavender Honey (`lavender_honey`), Cheongdo Bansi (`cheongdo_bansi`), American Persimmon (`american_persimmon`), Chocolate Persimmon (`chocolate_persimmon`), Sangju Persimmon (`sangju_persimmon`), Rugosa Hips (`rugosa_hips`), Apple Rose Hips (`apple_rose_hips`), Panela (`panela_sugar`), Piloncillo (`piloncillo_sugar`), Tonda di Giffoni (`tonda_giffoni`), Kentish Cob (`kentish_cob`), Cosford (`cosford_cob`), Almonds (`almonds`), Pecans (`pecans`), Ancho (`ancho_pods`), Pasilla (`pasilla_pods`), Chamomile (`chamomile`), Galangal (`galangal_root`), Rhubarb (Victoria) (`rhubarb_victoria`), Sumac Berries (`sumac_berries`), Lemon Balm (`lemon_balm`), Lemongrass (`lemongrass`), Lemon Myrtle (`lemon_myrtle`), Oats (`oats`), Naked Oats (`naked_oats`), Guernsey Milk (`guernsey_milk`), Welsh Black Milk (`welsh_black_milk`), Dexter Milk (`dexter_milk`), Brown Swiss Milk (`brown_swiss_milk`), Matsoni Culture (`matsoni_starter`), Bulgarian Yoghurt Culture (`bulgarian_starter`), Viili Culture (`villi_starter`), Filmjolk Culture (`filmjolk_starter`), Yamada Nishiki (`yamada_nishiki`), Naked Barley (`naked_barley`), Turkey Red Wheat (`turkey_red`), Cherokee White Eagle (`cherokee_white_eagle_corn`), Black Badger Peas (`black_badger_peas`), Aquadulce Broad Beans (`aquadulce_beans`), Anasazi Beans (`anasazi_beans`), Christmas Lima (`christmas_lima_beans`), Principe Borghese (`principe_borghese`), Yellow Pear (`yellow_pear_tomato`)

### Pictures not used in the game yet

Sheet 8 (equipment and status icons: crocks, jars, press, churn, bubbles, mould, hourglass, star, snowflake, flame) is all spare, because the game draws its own vessels and icons. Sheet 1: cucumber, scallions. Sheet 3: grey sea salt. Sheet 4: dill, star anise, liquorice root, colatura di alici, kombu. Sheet 5: the kimchi variants (fresh, ripe, aged, white, vegan, kkakdugi), garlic-bud capers, green and ripe tomato jars, tomato water, tomato-skin powder, black carrot, cucumber, beetroot and mixed-pepper ferments, kimchi juice, and all the plated dishes. Sheet 6: koji tray, shoyu koji, fava, chickpea and black-soy miso, light and dark shoyu, moromi, shoyu lees, koji buttermilk, miso walnuts, the two soups and salads, boshi vinegar, garlic honey syrup, rosehip and blackcurrant cheong. Sheet 7: the elderflower and rose oxymels, ginger bug, turmeric, rhubarb and sumac sodas, sparkling seidr, pomace, sowens porridge, pozol, labneh, kefir, kefir cheese, whey, villi, matsoni, vinegar mother, sourdough starter and loaf, and the two preserves. Most of them are the finished look of an existing recipe at a different age or with a different ingredient; the game shows one icon per recipe, so they wait for a feature that picks the icon by age or ingredient.

## 5. How the notes work

New recipes, and the existing recipes listed in section 1, show your look / smell / taste / feel lines on the batch's tasting card, picked by age: *fresh* before the peak window, *ripe* inside it, *aged* well past it. Recipes with one profile use it throughout. Spoiled batches keep the game's own 'gone over' wording. The game's own critique (too sharp, short on savour…) is still appended to the taste line.

## 6. Things to know

- The numbers (durations, ideal temperature, flavour targets, prices) are my estimates, tuned to sit next to similar existing recipes. They are worth a playtest.
- Two small engine additions: a `herb` ingredient token (Quick Fermented Relish needs one) and the age-staged notes above.
- New produce is not growable on the estate yet; it is buy-only.
- `index.html` is the built game. If it is regenerated from source without this block, these recipes disappear; `pantry-pack.js` is the block to carry across.
