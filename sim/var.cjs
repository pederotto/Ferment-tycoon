// constants.ts
var RECIPE_MATRIX = [
  // Direct koji substrates — these ran before everything else and ignore the vessel.
  { recipeId: "shio_koji", substrate: { kind: "none" }, requires: ["koji", "salt", "water"], vesselId: null },
  { recipeId: "amazake", substrate: { kind: "none" }, requires: ["koji", "water"], forbids: ["salt"], vesselId: null },
  { recipeId: "shio_koji", substrate: { kind: "none" }, requires: ["koji", "salt"], forbids: ["water"], vesselId: null },
  { recipeId: "colatura", substrate: { kind: "is", id: "anchovies" }, requires: ["salt"], vesselId: "oak_cask" },
  { recipeId: "bottarga", substrate: { kind: "is", id: "mullet_roe" }, requires: ["salt"], vesselId: "koji_tray" },
  { recipeId: "ricotta_forte", substrate: { kind: "is", id: "raw_milk" }, requires: ["salt"], vesselId: "onggi" },
  { recipeId: "garum_sociorum", substrate: { kind: "is", id: "mackerel" }, requires: ["salt"], vesselId: "incubator" },
  { recipeId: "doubanjiang", substrate: { kind: "is", id: "broad_beans" }, requires: ["chili", "koji", "salt"], vesselId: "onggi" },
  { recipeId: "douchi", substrate: { kind: "is", id: "black_soybeans" }, requires: ["spores", "salt"], vesselId: "mason_jar" },
  { recipeId: "gochujang", substrate: { kind: "is", id: "glutinous_rice" }, requires: ["koji", "chili", "salt"], vesselId: "onggi" },
  { recipeId: "cheong", substrate: { kind: "is", id: "pine_needles" }, requires: ["sugar"], vesselId: "mason_jar" },
  { recipeId: "hatcho_miso", substrate: { kind: "includes", token: "soybean" }, requires: ["spores", "salt"], vesselId: "cedar_barrel" },
  { recipeId: "shiro_miso", substrate: { kind: "includes", token: "soybean" }, requires: ["koji", "salt"], vesselId: "mason_jar" },
  { recipeId: "nuoc_mam", substrate: { kind: "is", id: "anchovies" }, requires: ["salt"], vesselId: "cedar_barrel" },
  { recipeId: "bagoong", substrate: { kind: "is", id: "shrimp_fry" }, requires: ["salt"], vesselId: "mason_jar" },
  { recipeId: "coconut_vin", substrate: { kind: "is", id: "coconut_sap" }, requires: [], vesselId: "mason_jar" },
  { recipeId: "scallop_fudge", substrate: { kind: "is", id: "scallops" }, requires: ["koji"], vesselId: "incubator" },
  { recipeId: "lacto_ceps", substrate: { kind: "is", id: "ceps" }, requires: ["salt"], vesselId: "mason_jar" },
  { recipeId: "rose_garum", substrate: { kind: "is", id: "rose_petals" }, requires: ["koji", "water"], vesselId: "incubator" },
  { recipeId: "black_apple", substrate: { kind: "oneOf", ids: ["garlic_bulbs", "plums"] }, requires: [], forbids: ["salt"], vesselId: "incubator" },
  { recipeId: "yellow_peaso", substrate: { kind: "is", id: "yellow_peas" }, requires: ["barley_koji", "salt"], vesselId: "mason_jar" },
  { recipeId: "tears_garum", substrate: { kind: "any" }, requires: ["tears", "koji", "salt"], vesselId: "incubator" },
  { recipeId: "casu_marzu", substrate: { kind: "is", id: "raw_milk" }, requires: ["larvae"], vesselId: "koji_tray" },
  { recipeId: "ancient_garum", substrate: { kind: "is", id: "mackerel" }, requires: ["ancient_spores"], vesselId: "onggi" },
  // Catch-all: anything sporulated on a tray becomes koji. Must stay last.
  { recipeId: "barley_koji", substrate: { kind: "present" }, requires: ["spores"], vesselId: "koji_tray" }
];
var VESSELS = [
  {
    id: "mason_jar",
    name: "Glass Jar",
    slotsRequired: 1,
    powerDraw: 0,
    cost: 20,
    description: "Basic anaerobic vessel. Good for beginners.",
    idealFor: ["Lacto-Fermentation" /* LACTO */, "Vinegar" /* VINEGAR */, "Alcoholic Brew" /* ALCOHOL */],
    insulationFactor: 0.2,
    capacityL: 2
  },
  {
    id: "koji_tray",
    name: "Cedar Tray",
    slotsRequired: 1,
    powerDraw: 0,
    cost: 50,
    description: "Wide surface area for aerobic mold growth.",
    idealFor: ["Koji Cultivation" /* KOJI */, "Miso/Paste" /* MISO */],
    insulationFactor: 0.1,
    capacityL: 3
  },
  {
    id: "onggi",
    name: "Earthenware Onggi",
    slotsRequired: 2,
    powerDraw: 0,
    cost: 200,
    description: "Micro-porous clay. Breathable yet insulating.",
    idealFor: ["Miso/Paste" /* MISO */, "Shoyu/Sauce" /* SHOYU */, "Lacto-Fermentation" /* LACTO */],
    insulationFactor: 0.7,
    capacityL: 20
  },
  {
    id: "incubator",
    name: "Thermal Chamber",
    slotsRequired: 2,
    powerDraw: 150,
    cost: 1500,
    description: "Precise temperature control for sensitive projects.",
    idealFor: ["Garum" /* GARUM */, "Blackening" /* BLACK */, "Koji Cultivation" /* KOJI */],
    insulationFactor: 0.9,
    capacityL: 10
  },
  {
    id: "cedar_barrel",
    name: "Cedar Barrel",
    slotsRequired: 4,
    powerDraw: 0,
    cost: 500,
    description: "Large scale wood fermentation. Adds tannin.",
    idealFor: ["Miso/Paste" /* MISO */, "Shoyu/Sauce" /* SHOYU */, "Vinegar" /* VINEGAR */],
    insulationFactor: 0.5,
    capacityL: 50
  },
  {
    id: "oak_cask",
    name: "Oak Cask",
    slotsRequired: 4,
    powerDraw: 0,
    cost: 800,
    description: "For long-aging liquids. Complex flavor development.",
    idealFor: ["Garum" /* GARUM */, "Alcoholic Brew" /* ALCOHOL */, "Vinegar" /* VINEGAR */],
    insulationFactor: 0.6,
    capacityL: 60
  }
];
var INGREDIENTS = [
  // --- SUBSTRATES ---
  {
    id: "barley",
    name: "Pearl Barley",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 5,
    currency: "money",
    quality: 60,
    description: "Polished grains, perfect for Koji.",
    idealFor: ["koji"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 3 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "soybeans",
    name: "Yellow Soybeans",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 8,
    currency: "money",
    quality: 70,
    description: "High protein legume for Miso.",
    idealFor: ["miso", "shoyu"],
    supplierId: "asia_import",
    tierRequired: 0,
    hiddenStats: { sugarContent: 3, nativeSalinity: 0, microbialDiversity: 3, fatContent: 4, proteinContent: 9 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "black_soybeans",
    name: "Black Soybeans",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 15,
    currency: "money",
    quality: 85,
    description: "Rich, savory beans for Douchi.",
    idealFor: ["miso"],
    supplierId: "asia_import",
    tierRequired: 2,
    hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 4, fatContent: 5, proteinContent: 9 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "glutinous_rice",
    name: "Glutinous Rice",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 12,
    currency: "money",
    quality: 75,
    description: "Sticky rice, high starch content.",
    idealFor: ["miso", "alcohol"],
    supplierId: "asia_import",
    tierRequired: 1,
    hiddenStats: { sugarContent: 8, nativeSalinity: 0, microbialDiversity: 2, fatContent: 1, proteinContent: 2 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "raw_milk",
    name: "Raw Milk",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 25,
    currency: "money",
    quality: 80,
    description: "Unpasteurized dairy. High risk, high reward.",
    idealFor: ["lacto", "cheese"],
    supplierId: "prime",
    tierRequired: 2,
    hiddenStats: { sugarContent: 5, nativeSalinity: 1, microbialDiversity: 8, fatContent: 8, proteinContent: 6 },
    mass: 1e3,
    unitDisplay: "ml",
    tags: ["HIGH_RISK"]
  },
  {
    id: "anchovies",
    name: "Fresh Anchovies",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 40,
    currency: "money",
    quality: 90,
    description: "Oily fish, perfect for Garum.",
    idealFor: ["garum"],
    supplierId: "prime",
    tierRequired: 1,
    hiddenStats: { sugarContent: 0, nativeSalinity: 2, microbialDiversity: 6, fatContent: 7, proteinContent: 8 },
    mass: 1e3,
    unitDisplay: "g",
    tags: ["SEAFOOD"]
  },
  {
    id: "mackerel",
    name: "Mackerel",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 35,
    currency: "money",
    quality: 80,
    description: "Strong flavored fish.",
    idealFor: ["garum"],
    supplierId: "prime",
    tierRequired: 1,
    hiddenStats: { sugarContent: 0, nativeSalinity: 1, microbialDiversity: 5, fatContent: 9, proteinContent: 8 },
    mass: 1e3,
    unitDisplay: "g",
    tags: ["SEAFOOD"]
  },
  {
    id: "mullet_roe",
    name: "Mullet Roe Sack",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 120,
    currency: "money",
    quality: 95,
    description: "Precious roe for Bottarga.",
    idealFor: ["curing"],
    supplierId: "prime",
    tierRequired: 3,
    hiddenStats: { sugarContent: 1, nativeSalinity: 2, microbialDiversity: 4, fatContent: 8, proteinContent: 9 },
    mass: 500,
    unitDisplay: "g",
    tags: ["SEAFOOD", "HIGH_RISK"]
  },
  {
    id: "scallops",
    name: "Dried Scallops",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 200,
    currency: "money",
    quality: 100,
    description: "Concentrated Umami bombs.",
    idealFor: ["amino_paste"],
    supplierId: "prime",
    tierRequired: 4,
    hiddenStats: { sugarContent: 4, nativeSalinity: 3, microbialDiversity: 2, fatContent: 2, proteinContent: 10 },
    mass: 500,
    unitDisplay: "g",
    tags: ["SEAFOOD"]
  },
  {
    id: "ceps",
    name: "Wild Ceps (Porcini)",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 150,
    currency: "money",
    quality: 95,
    description: "Forest mushrooms. Earthy and sweet.",
    idealFor: ["lacto", "shoyu"],
    supplierId: "nordic",
    tierRequired: 3,
    hiddenStats: { sugarContent: 3, nativeSalinity: 0, microbialDiversity: 7, fatContent: 1, proteinContent: 5 },
    mass: 500,
    unitDisplay: "g"
  },
  {
    id: "plums",
    name: "Green Plums",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 15,
    currency: "money",
    quality: 70,
    description: "Unripe fruit, high acidity.",
    idealFor: ["lacto", "vinegar"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "yellow_peas",
    name: "Yellow Peas",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 8,
    currency: "money",
    quality: 60,
    description: "Alternative to soy. Sweet and grassy.",
    idealFor: ["miso"],
    supplierId: "nordic",
    tierRequired: 1,
    hiddenStats: { sugarContent: 5, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 7 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "garlic_bulbs",
    name: "Whole Garlic",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 20,
    currency: "money",
    quality: 80,
    description: "Pungent allium. Turns black with heat.",
    idealFor: ["black"],
    supplierId: "asia_import",
    tierRequired: 1,
    hiddenStats: { sugarContent: 7, nativeSalinity: 0, microbialDiversity: 4, fatContent: 1, proteinContent: 4 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "broad_beans",
    name: "Broad Beans",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 10,
    currency: "money",
    quality: 65,
    description: "Fava beans. Key for Doubanjiang.",
    idealFor: ["miso"],
    supplierId: "asia_import",
    tierRequired: 1,
    hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 3, fatContent: 2, proteinContent: 8 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "shrimp_fry",
    name: "Krill / Shrimp Fry",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 30,
    currency: "money",
    quality: 75,
    description: "Tiny crustaceans for Bagoong.",
    idealFor: ["miso"],
    supplierId: "asia_import",
    tierRequired: 2,
    hiddenStats: { sugarContent: 1, nativeSalinity: 3, microbialDiversity: 8, fatContent: 4, proteinContent: 9 },
    mass: 1e3,
    unitDisplay: "g",
    tags: ["SEAFOOD"]
  },
  {
    id: "coconut_sap",
    name: "Coconut Sap",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 25,
    currency: "money",
    quality: 80,
    description: "Sweet nectar for Tuba/Vinegar.",
    idealFor: ["vinegar"],
    supplierId: "asia_import",
    tierRequired: 2,
    hiddenStats: { sugarContent: 10, nativeSalinity: 0, microbialDiversity: 6, fatContent: 2, proteinContent: 1 },
    mass: 1e3,
    unitDisplay: "ml"
  },
  {
    id: "pine_needles",
    name: "Young Pine Needles",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 5,
    currency: "money",
    quality: 90,
    description: "Foraged wild aromatics.",
    idealFor: ["syrup"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 2, nativeSalinity: 0, microbialDiversity: 9, fatContent: 3, proteinContent: 0 },
    mass: 500,
    unitDisplay: "g"
  },
  {
    id: "rose_petals",
    name: "Damask Rose Petals",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 60,
    currency: "money",
    quality: 95,
    description: "Highly aromatic floral matter.",
    idealFor: ["garum", "syrup"],
    supplierId: "prime",
    tierRequired: 3,
    hiddenStats: { sugarContent: 4, nativeSalinity: 0, microbialDiversity: 5, fatContent: 1, proteinContent: 1 },
    mass: 250,
    unitDisplay: "g"
  },
  // --- STARTERS ---
  {
    id: "koji_spores",
    name: "A. Oryzae Spores",
    type: "STARTER" /* STARTER */,
    baseCost: 15,
    currency: "money",
    quality: 80,
    description: "Standard Yellow Koji-kin.",
    idealFor: ["koji"],
    supplierId: "biolab",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 5, fatContent: 0, proteinContent: 0 },
    mass: 10,
    unitDisplay: "g",
    isLiving: true
  },
  {
    id: "ancient_spores",
    name: "Ancient Spores",
    type: "STARTER" /* STARTER */,
    baseCost: 420,
    currency: "money",
    quality: 100,
    description: "Recovered from a clay pot 1000 years old. Unpredictable.",
    idealFor: ["garum"],
    supplierId: "black_market",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 0, proteinContent: 0 },
    mass: 5,
    unitDisplay: "g",
    isLiving: true,
    tags: ["HIGH_RISK"],
    contraband: true,
    heatPerUnit: 12,
    undergroundTier: 1
  },
  {
    id: "fly_larvae",
    name: "Cheese Fly Larvae",
    type: "STARTER" /* STARTER */,
    baseCost: 260,
    currency: "money",
    quality: 90,
    description: "Piophila casei. Illegal in most countries.",
    idealFor: ["cheese"],
    supplierId: "black_market",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 10, fatContent: 5, proteinContent: 10 },
    mass: 50,
    unitDisplay: "g",
    isLiving: true,
    tags: ["BIOHAZARD"],
    contraband: true,
    heatPerUnit: 15,
    undergroundTier: 2
  },
  // --- ADDITIVES ---
  {
    id: "salt",
    name: "Sea Salt",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 2,
    currency: "money",
    quality: 50,
    description: "Basic NaCl. Prevents spoilage.",
    idealFor: ["all"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 10, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "trapani_salt",
    name: "Trapani Sea Salt",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 15,
    currency: "money",
    quality: 90,
    description: "Hand-harvested Sicilian salt. Rich in minerals.",
    idealFor: ["all"],
    supplierId: "prime",
    tierRequired: 2,
    hiddenStats: { sugarContent: 0, nativeSalinity: 10, microbialDiversity: 1, fatContent: 0, proteinContent: 0 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "water",
    name: "Filtered Water",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 1,
    currency: "money",
    quality: 50,
    description: "H2O. Essential for brine.",
    idealFor: ["all"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 1e3,
    unitDisplay: "ml"
  },
  {
    id: "sugar",
    name: "Cane Sugar",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 5,
    currency: "money",
    quality: 60,
    description: "Food for yeast.",
    idealFor: ["alcohol", "syrup"],
    supplierId: "nordic",
    tierRequired: 0,
    hiddenStats: { sugarContent: 10, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "chili",
    name: "Dried Chilies",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 12,
    currency: "money",
    quality: 70,
    description: "Adds heat and antibacterial properties.",
    idealFor: ["miso"],
    supplierId: "asia_import",
    tierRequired: 1,
    hiddenStats: { sugarContent: 2, nativeSalinity: 0, microbialDiversity: 2, fatContent: 0, proteinContent: 0 },
    mass: 250,
    unitDisplay: "g"
  },
  {
    id: "tears",
    name: "Vial of Tears",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 900,
    currency: "money",
    quality: 100,
    description: "Collected from the grieving. Saline and sorrowful.",
    idealFor: ["garum"],
    supplierId: "black_market",
    tierRequired: 0,
    hiddenStats: { sugarContent: 0, nativeSalinity: 9, microbialDiversity: 5, fatContent: 0, proteinContent: 1 },
    mass: 50,
    unitDisplay: "ml",
    contraband: true,
    heatPerUnit: 22,
    undergroundTier: 3
  },
  {
    id: "wheat",
    name: "Roasted Wheat",
    type: "ADDITIVE" /* ADDITIVE */,
    baseCost: 5,
    currency: "money",
    quality: 65,
    description: "Essential for Shoyu.",
    idealFor: ["shoyu"],
    supplierId: "asia_import",
    tierRequired: 0,
    hiddenStats: { sugarContent: 5, nativeSalinity: 0, microbialDiversity: 1, fatContent: 0, proteinContent: 2 },
    mass: 1e3,
    unitDisplay: "g"
  },
  // --- PROCESSED INTERMEDIATES (Can be bought or made) ---
  {
    id: "barley_koji",
    name: "Barley Koji",
    type: "SUBSTRATE" /* SUBSTRATE */,
    // Can act as substrate for miso
    baseCost: 25,
    currency: "money",
    quality: 80,
    description: "Ready-to-use inoculated barley.",
    idealFor: ["miso"],
    supplierId: "in_house",
    // Or buy from Biolab
    tierRequired: 0,
    hiddenStats: { sugarContent: 6, nativeSalinity: 0, microbialDiversity: 8, fatContent: 1, proteinContent: 4 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "koji_rice",
    name: "Rice Koji",
    type: "SUBSTRATE" /* SUBSTRATE */,
    baseCost: 30,
    currency: "money",
    quality: 80,
    description: "Inoculated rice grains.",
    idealFor: ["miso", "amazake"],
    supplierId: "biolab",
    tierRequired: 1,
    hiddenStats: { sugarContent: 8, nativeSalinity: 0, microbialDiversity: 8, fatContent: 0, proteinContent: 2 },
    mass: 1e3,
    unitDisplay: "g"
  },
  {
    id: "amino_sauce",
    name: "Amino Sauce (Shoyu)",
    type: "ADDITIVE" /* ADDITIVE */,
    // Treated as sauce
    baseCost: 40,
    currency: "money",
    quality: 80,
    description: "Pressed liquid savory seasoning.",
    idealFor: ["flavor"],
    supplierId: "in_house",
    tierRequired: 0,
    hiddenStats: { sugarContent: 2, nativeSalinity: 10, microbialDiversity: 5, fatContent: 0, proteinContent: 8 },
    mass: 1e3,
    unitDisplay: "ml"
  },
  // --- TOOLS ---
  {
    id: "portable_fan",
    name: "Clip-on Fan",
    type: "TOOL" /* TOOL */,
    baseCost: 150,
    currency: "money",
    quality: 50,
    description: "Increases evaporation. Cools Koji.",
    idealFor: ["koji"],
    supplierId: "tech",
    tierRequired: 1,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 500,
    unitDisplay: "g"
  },
  {
    id: "humidifier",
    name: "Ultrasonic Mister",
    type: "TOOL" /* TOOL */,
    baseCost: 250,
    currency: "money",
    quality: 70,
    description: "Maintains high humidity.",
    idealFor: ["koji", "curing"],
    supplierId: "tech",
    tierRequired: 2,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 800,
    unitDisplay: "g"
  },
  {
    id: "wooden_press",
    name: "Hydro-Press",
    type: "TOOL" /* TOOL */,
    baseCost: 500,
    currency: "money",
    quality: 80,
    description: "Extracts liquid from mash. Increases yield.",
    idealFor: ["shoyu"],
    supplierId: "tech",
    tierRequired: 3,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 5e3,
    unitDisplay: "g"
  },
  {
    id: "centrifuge",
    name: "Centrifuge",
    type: "TOOL" /* TOOL */,
    baseCost: 2e3,
    currency: "money",
    quality: 100,
    description: "Clarifies liquids by force. Removes solids.",
    idealFor: ["garum", "vinegar"],
    supplierId: "tech",
    tierRequired: 5,
    hiddenStats: { sugarContent: 0, nativeSalinity: 0, microbialDiversity: 0, fatContent: 0, proteinContent: 0 },
    mass: 1e4,
    unitDisplay: "g"
  }
];
var greyCopy = (src, tier, heat) => ({
  id: `bm_${src.id}`,
  name: `${src.name} (no papers)`,
  type: src.type,
  baseCost: Math.round(src.baseCost * 0.48),
  currency: "money",
  quality: Math.max(10, src.quality - 30),
  description: `Unlabelled ${src.name.toLowerCase()}. Half price, no provenance, no questions.`,
  idealFor: src.idealFor,
  supplierId: "black_market",
  tierRequired: 0,
  hiddenStats: src.hiddenStats,
  mass: src.mass,
  unitDisplay: src.unitDisplay,
  tags: [...src.tags ?? [], "GREY_MARKET"],
  contraband: true,
  heatPerUnit: heat,
  legitCounterpartId: src.id,
  undergroundTier: tier
});
var GREY_MARKET_SOURCES = [
  { id: "anchovies", tier: 1, heat: 2 },
  { id: "mackerel", tier: 1, heat: 2 },
  { id: "raw_milk", tier: 1, heat: 3 },
  { id: "mullet_roe", tier: 2, heat: 4 },
  { id: "scallops", tier: 2, heat: 4 }
];
GREY_MARKET_SOURCES.forEach(({ id, tier, heat }) => {
  const src = INGREDIENTS.find((i) => i.id === id);
  if (src) INGREDIENTS.push(greyCopy(src, tier, heat));
});
var BUYERS = [
  {
    id: "culinary_coop",
    name: "Metropolitan Culinary Co-op",
    type: "Private",
    description: "Local culinary network & craft fermentation exchange. Always buys honest ferments at fair market value.",
    minReputation: 0,
    desiredTypes: [
      "Lacto-Fermentation" /* LACTO */,
      "Koji Cultivation" /* KOJI */,
      "Miso/Paste" /* MISO */,
      "Shoyu/Sauce" /* SHOYU */,
      "Garum" /* GARUM */,
      "Vinegar" /* VINEGAR */,
      "Blackening" /* BLACK */,
      "Alcoholic Brew" /* ALCOHOL */
    ],
    minScore: 10,
    paysIn: "money",
    priceMultiplier: 1,
    dialogue: {
      intro: "We distribute artisan and craft ferments across local restaurant kitchens.",
      success: "Clean artisan batch accepted! Payment disbursed immediately.",
      reject: "Contaminated or unusable batch."
    }
  },
  {
    id: "bio_reclamation",
    name: "Bio-Organic Reclamation Co.",
    type: "Industry",
    description: "Salvages spoiled, over-fermented, or contaminated cultures for enzymatic fertilizer compost.",
    minReputation: 0,
    desiredTypes: [
      "Bio-Hazard" /* FAIL */,
      "Lacto-Fermentation" /* LACTO */,
      "Koji Cultivation" /* KOJI */,
      "Miso/Paste" /* MISO */,
      "Shoyu/Sauce" /* SHOYU */,
      "Garum" /* GARUM */,
      "Vinegar" /* VINEGAR */,
      "Blackening" /* BLACK */,
      "Alcoholic Brew" /* ALCOHOL */
    ],
    minScore: 0,
    paysIn: "money",
    priceMultiplier: 0.4,
    dialogue: {
      intro: "We reclaim biological mass for nutrient compost and organic fertilizer.",
      success: "Salvage verified. Biological haul compensation transferred.",
      reject: "Nothing to salvage."
    }
  },
  {
    id: "food_blogger",
    name: "Trending Eats",
    type: "Private",
    description: "Influencer looking for content. Pays in Exposure (Renown).",
    minReputation: 0,
    desiredTypes: ["Lacto-Fermentation" /* LACTO */, "Vinegar" /* VINEGAR */, "Alcoholic Brew" /* ALCOHOL */],
    minScore: 50,
    paysIn: "renown",
    priceMultiplier: 1,
    dialogue: { intro: "Can I film this for my story?", success: "My followers love it!", reject: "Not photogenic enough." }
  },
  {
    id: "mega_mart",
    name: "SuperSave Market",
    type: "Supermarket",
    description: "Requires high volume and safety. Low margins.",
    minReputation: 0,
    desiredTypes: ["Lacto-Fermentation" /* LACTO */, "Vinegar" /* VINEGAR */],
    minScore: 40,
    paysIn: "money",
    priceMultiplier: 0.8,
    dialogue: { intro: "We need 500 units for aisle 4.", success: "Adequate. Payment sent.", reject: "This is inconsistent. Rejected." }
  },
  {
    id: "hipster_deli",
    name: "The Fermented Jar",
    type: "Private",
    description: "Boutique shop. Likes trendy, funky items.",
    minReputation: 10,
    desiredTypes: ["Miso/Paste" /* MISO */, "Koji Cultivation" /* KOJI */, "Lacto-Fermentation" /* LACTO */],
    minScore: 60,
    paysIn: "money",
    priceMultiplier: 1.5,
    dialogue: { intro: "Got anything... alive?", success: "The microbes are singing!", reject: "Too commercial. Pass." }
  },
  {
    id: "fine_dining",
    name: "L'Etoile du Nord",
    type: "Restaurant",
    description: "2-Star Michelin. Demands perfection and complexity.",
    minReputation: 50,
    desiredTypes: ["Garum" /* GARUM */, "Shoyu/Sauce" /* SHOYU */, "Blackening" /* BLACK */],
    minScore: 85,
    paysIn: "renown",
    priceMultiplier: 2.5,
    dialogue: { intro: "Surprise my palate.", success: "Exquisite. I will mention your name.", reject: "Pedestrian garbage." }
  },
  {
    id: "korean_bbq",
    name: "Han's Grill",
    type: "Restaurant",
    description: "High volume, traditional Korean flavors.",
    minReputation: 20,
    desiredTypes: ["Miso/Paste" /* MISO */],
    minScore: 70,
    paysIn: "money",
    priceMultiplier: 1.2,
    dialogue: { intro: "Need strong jang for the marinade.", success: "Good depth. More next week.", reject: "Weak flavor." }
  },
  {
    id: "sichuan_house",
    name: "Red Dragon Wok",
    type: "Restaurant",
    description: "Needs authentic, numbing fermentation.",
    minReputation: 25,
    desiredTypes: ["Miso/Paste" /* MISO */],
    // Doubanjiang
    minScore: 75,
    paysIn: "money",
    priceMultiplier: 1.4,
    dialogue: { intro: "Is it authentic?", success: "Perfect spice.", reject: "Lacks soul." }
  },
  {
    id: "pharma",
    name: "Zenith Pharma",
    type: "Industry",
    description: "Buying enzymes and molds for extraction.",
    minReputation: 30,
    desiredTypes: ["Koji Cultivation" /* KOJI */, "Vinegar" /* VINEGAR */],
    minScore: 80,
    paysIn: "money",
    priceMultiplier: 2,
    dialogue: { intro: "Purity is paramount.", success: "Bio-availability is high. Proceed.", reject: "Contaminated." }
  },
  {
    // --- THE FENCES ---
    // These pay MONEY, and they buy exactly what the licensed trade refuses.
    // That is the whole point: failure now has an outlet with teeth, instead
    // of only the 0.4x Bio-Reclamation salvage floor.
    id: "bio_broker",
    name: "Vitrine & Sons",
    type: "Underground",
    description: "Reclamation brokers. No questions about what died in there.",
    minReputation: 0,
    desiredTypes: [
      "Garum" /* GARUM */,
      "Miso/Paste" /* MISO */,
      "Lacto-Fermentation" /* LACTO */,
      "Shoyu/Sauce" /* SHOYU */,
      "Vinegar" /* VINEGAR */,
      "Blackening" /* BLACK */,
      "Koji Cultivation" /* KOJI */,
      "Alcoholic Brew" /* ALCOHOL */,
      "Bio-Hazard" /* FAIL */
    ],
    minScore: 0,
    paysIn: "money",
    priceMultiplier: 1,
    undergroundTier: 1,
    pricesContraband: true,
    maxSafety: 55,
    // refuses anything a legitimate buyer would take
    heatPerSale: 8,
    dialogue: { intro: "Show us the ruined stock.", success: "We can move that.", reject: "Too wholesome. Try a grocer." }
  },
  {
    id: "collector",
    name: "The Curator",
    type: "Underground",
    description: "Buys dangerous or extinct flavors. Illegal.",
    minReputation: 0,
    desiredTypes: ["Garum" /* GARUM */, "Miso/Paste" /* MISO */, "Blackening" /* BLACK */, "Bio-Hazard" /* FAIL */],
    minScore: 0,
    paysIn: "money",
    priceMultiplier: 3.2,
    undergroundTier: 2,
    pricesContraband: true,
    requiresContraband: true,
    // only wants things with no provenance
    requiresIntact: true,
    // but not rot — it must still be a thing
    heatPerSale: 12,
    dialogue: { intro: "Do you have the forbidden sauce?", success: "Thrillingly toxic.", reject: "Boringly safe." }
  },
  {
    id: "night_market",
    name: "The Night Market",
    type: "Underground",
    description: "Cash, crates, no paperwork. Pays under the odds but never asks.",
    minReputation: 0,
    desiredTypes: [
      "Lacto-Fermentation" /* LACTO */,
      "Miso/Paste" /* MISO */,
      "Koji Cultivation" /* KOJI */,
      "Shoyu/Sauce" /* SHOYU */,
      "Vinegar" /* VINEGAR */,
      "Alcoholic Brew" /* ALCOHOL */,
      "Blackening" /* BLACK */,
      "Garum" /* GARUM */
    ],
    minScore: 25,
    paysIn: "money",
    priceMultiplier: 0.9,
    undergroundTier: 2,
    heatPerSale: 5,
    dialogue: { intro: "Cash tonight, no receipt.", success: "Pleasure.", reject: "Not worth the crate." }
  },
  {
    id: "mixologist",
    name: "The Alchemist Bar",
    type: "Private",
    description: "Experimental cocktail bar. Needs unique acids and umami.",
    minReputation: 15,
    desiredTypes: ["Alcoholic Brew" /* ALCOHOL */, "Vinegar" /* VINEGAR */, "Garum" /* GARUM */],
    minScore: 65,
    paysIn: "money",
    priceMultiplier: 1.8,
    dialogue: { intro: "I need something to shock the senses.", success: "This will make a phenomenal garnish.", reject: "Flat. Boring." }
  },
  {
    id: "school_district",
    name: "City District Schools",
    type: "Industry",
    description: "Bulk buying for cafeteria lunches. Low standards.",
    minReputation: 5,
    desiredTypes: ["Miso/Paste" /* MISO */],
    minScore: 30,
    paysIn: "money",
    priceMultiplier: 0.6,
    dialogue: { intro: "We need 50kg of paste, doesn't need to be fancy.", success: "Contract signed.", reject: "Too expensive or weird." }
  },
  {
    id: "vegan_startup",
    name: "No-Moo Foods",
    type: "Industry",
    description: "Creating plant-based alternatives. Paying for clean labels.",
    minReputation: 20,
    desiredTypes: ["Lacto-Fermentation" /* LACTO */, "Miso/Paste" /* MISO */],
    minScore: 75,
    paysIn: "money",
    priceMultiplier: 1.6,
    dialogue: { intro: "Is it 100% plant-based and punchy?", success: "Excellent umami profile.", reject: "Contains animal notes." }
  }
];
var RECIPES = [
  // --- 1. THE ITALIAN SCHOOL (Time & Wood) ---
  {
    id: "colatura",
    name: "Colatura di Alici",
    type: "Garum" /* GARUM */,
    description: "The Waiting Game. Oak aging required. Harvest early = Failure.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "colatura_bottle",
    requiredVesselId: "oak_cask",
    baseDurationSeconds: 400,
    // Very Slow
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Stir",
    idealParams: { temp: 20, humidity: 60, salinity: 25 },
    idealFlavorProfile: { umami: 95, acidity: 10, funk: 30, sweetness: 5, safety: 100 },
    difficulty: 3
  },
  {
    id: "bottarga",
    name: "Cured Bottarga",
    type: "Miso/Paste" /* MISO */,
    // Mechanic: Curing
    description: "Dry Curing. If humidity spikes > 40%, it rots immediately.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "bottarga_block",
    requiredVesselId: "koji_tray",
    // For airflow
    baseDurationSeconds: 60,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Flip",
    idealParams: { temp: 15, humidity: 30, salinity: 15 },
    // Needs LOW humidity
    idealFlavorProfile: { umami: 85, acidity: 5, funk: 40, sweetness: 10, safety: 95 },
    difficulty: 2
  },
  {
    id: "ricotta_forte",
    name: "Ricotta Forte",
    type: "Lacto-Fermentation" /* LACTO */,
    description: "Controlled Rot. Requires frequent stirring to prevent bad mold.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "ricotta_jar",
    requiredVesselId: "onggi",
    baseDurationSeconds: 120,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    idealParams: { temp: 18, humidity: 70, salinity: 5 },
    idealFlavorProfile: { umami: 60, acidity: 70, funk: 90, sweetness: 10, safety: 80 },
    difficulty: 4
  },
  {
    id: "garum_sociorum",
    name: "Garum Sociorum",
    type: "Garum" /* GARUM */,
    description: "Ancient Roman Ketchup. Mackerel fermented with heat for speed.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "garum_bottle",
    requiredVesselId: "incubator",
    baseDurationSeconds: 150,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: "Skim",
    idealParams: { temp: 40, humidity: 50, salinity: 20 },
    idealFlavorProfile: { umami: 100, acidity: 15, funk: 80, sweetness: 0, safety: 95 },
    difficulty: 2
  },
  // --- 2. THE EAST ASIAN SCHOOL (Koji & Soy) ---
  {
    id: "doubanjiang",
    name: "Pixian Doubanjiang",
    type: "Miso/Paste" /* MISO */,
    description: "The Soul of Sichuan. Requires stirring daily or chilies float and mold.",
    requiredIngredients: { substrate: true, starter: "koji_rice", additive: "chili" },
    // + Wheat implied
    outputIngredientId: "doubanjiang_paste",
    requiredVesselId: "onggi",
    baseDurationSeconds: 160,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    // Daily stir
    idealParams: { temp: 22, humidity: 60, salinity: 12 },
    idealFlavorProfile: { umami: 85, acidity: 25, funk: 60, sweetness: 15, safety: 100 },
    difficulty: 3
  },
  {
    id: "douchi",
    name: "Douchi (Black Beans)",
    type: "Miso/Paste" /* MISO */,
    description: "Savory umami bombs. Beans inoculated directly with spores.",
    requiredIngredients: { substrate: true, starter: "koji_spores", additive: "salt" },
    outputIngredientId: "douchi_jar",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 90,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Clean",
    idealParams: { temp: 25, humidity: 65, salinity: 12 },
    idealFlavorProfile: { umami: 90, acidity: 10, funk: 75, sweetness: 5, safety: 100 },
    difficulty: 2
  },
  {
    id: "gochujang",
    name: "Gochujang",
    type: "Miso/Paste" /* MISO */,
    description: "Starch Conversion. If temp is too high (>30C), turns into alcohol.",
    requiredIngredients: { substrate: true, starter: "koji_rice", additive: "chili" },
    // + Rice
    outputIngredientId: "gochujang_paste",
    requiredVesselId: "onggi",
    baseDurationSeconds: 140,
    peakWindowStart: 80,
    peakWindowEnd: 90,
    activeIntervention: "Stir",
    idealParams: { temp: 20, humidity: 55, salinity: 8 },
    idealFlavorProfile: { umami: 70, acidity: 20, funk: 30, sweetness: 70, safety: 100 },
    difficulty: 2
  },
  {
    id: "cheong",
    name: "Pine Needle Cheong",
    type: "Alcoholic Brew" /* ALCOHOL */,
    // Syrup/Extract
    description: "Osmotic Extraction. If Hygiene low -> Yeast Infection -> Moonshine.",
    requiredIngredients: { substrate: true, starter: null, additive: "sugar" },
    outputIngredientId: "cheong_syrup",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 100,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Ventilate",
    idealParams: { temp: 20, humidity: 50, salinity: 0 },
    idealFlavorProfile: { umami: 0, acidity: 20, funk: 10, sweetness: 100, safety: 100 },
    difficulty: 1
  },
  {
    id: "hatcho_miso",
    name: "Hatcho Miso",
    type: "Miso/Paste" /* MISO */,
    description: "The Emperor's Miso. Pure soybean koji in cedar. Chocolate-dark.",
    requiredIngredients: { substrate: true, starter: "koji_spores", additive: "salt" },
    outputIngredientId: "hatcho_miso",
    requiredVesselId: "cedar_barrel",
    baseDurationSeconds: 250,
    // Long
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: "Clean",
    idealParams: { temp: 20, humidity: 50, salinity: 10 },
    idealFlavorProfile: { umami: 95, acidity: 30, funk: 60, sweetness: 5, safety: 100 },
    difficulty: 4
  },
  {
    id: "shiro_miso",
    name: "Shiro Miso",
    type: "Miso/Paste" /* MISO */,
    description: "Sweet White Miso. High Koji ratio, short ferment.",
    requiredIngredients: { substrate: true, starter: "koji_rice", additive: "salt" },
    outputIngredientId: "shiro_miso",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 60,
    // Fast
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Clean",
    idealParams: { temp: 28, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 60, acidity: 5, funk: 10, sweetness: 80, safety: 100 },
    difficulty: 1
  },
  // --- 3. THE SOUTHEAST ASIAN SCHOOL ---
  {
    id: "nuoc_mam",
    name: "Nuoc Mam Nhi",
    type: "Garum" /* GARUM */,
    description: "First Press Fish Sauce. High salt, cedar aged.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "fish_sauce",
    requiredVesselId: "cedar_barrel",
    baseDurationSeconds: 300,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Stir",
    idealParams: { temp: 30, humidity: 70, salinity: 25 },
    idealFlavorProfile: { umami: 95, acidity: 20, funk: 90, sweetness: 5, safety: 100 },
    difficulty: 1
  },
  {
    id: "bagoong",
    name: "Bagoong Alamang",
    type: "Miso/Paste" /* MISO */,
    description: "Pink Ferment. Needs air (prop lid) to turn pink. Anaerobic = Grey.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "bagoong_paste",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 180,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Ventilate",
    // Needs air
    idealParams: { temp: 30, humidity: 60, salinity: 20 },
    idealFlavorProfile: { umami: 90, acidity: 20, funk: 85, sweetness: 10, safety: 100 },
    difficulty: 2
  },
  {
    id: "coconut_vin",
    name: "Tuba Vinegar",
    type: "Vinegar" /* VINEGAR */,
    description: "Two-Stage. First Alcohol (Tuba), then Vinegar. Timing is key.",
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: "coconut_vinegar",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 150,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    idealParams: { temp: 28, humidity: 70, salinity: 0 },
    idealFlavorProfile: { umami: 10, acidity: 90, funk: 30, sweetness: 10, safety: 100 },
    difficulty: 2
  },
  // --- 4. THE NOMA / MODERNIST SCHOOL ---
  {
    id: "scallop_fudge",
    name: "Scallop Fudge",
    type: "Blackening" /* BLACK */,
    description: "The Mistake. Dehydrated enzymatic paste. Ultra-high Umami, zero water.",
    requiredIngredients: { substrate: true, starter: "koji_rice", additive: null },
    // No added salt, uses evaporation
    outputIngredientId: "scallop_fudge",
    requiredVesselId: "incubator",
    baseDurationSeconds: 220,
    // Long
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: "Stir",
    idealParams: { temp: 60, humidity: 20, salinity: 0 },
    // Low humidity
    idealFlavorProfile: { umami: 100, acidity: 10, funk: 40, sweetness: 80, safety: 90 },
    difficulty: 4
  },
  {
    id: "lacto_ceps",
    name: "Lacto Porcini",
    type: "Lacto-Fermentation" /* LACTO */,
    description: "Texture Preservation. High humidity to mimic vacuum bag. Output is Porcini Soy.",
    requiredIngredients: { substrate: true, starter: null, additive: "salt" },
    outputIngredientId: "lacto_ceps",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 70,
    peakWindowStart: 80,
    peakWindowEnd: 90,
    activeIntervention: "Clean",
    idealParams: { temp: 20, humidity: 95, salinity: 2 },
    // High humidity
    idealFlavorProfile: { umami: 80, acidity: 60, funk: 30, sweetness: 10, safety: 95 },
    difficulty: 2
  },
  {
    id: "rose_garum",
    name: "Rose Garum",
    type: "Garum" /* GARUM */,
    description: "Perfume Risk. If too hot (>62C), floral notes vanish. Precise heat required.",
    requiredIngredients: { substrate: true, starter: "koji_rice", additive: "water" },
    outputIngredientId: "rose_garum",
    requiredVesselId: "incubator",
    baseDurationSeconds: 140,
    peakWindowStart: 85,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    idealParams: { temp: 60, humidity: 50, salinity: 0 },
    idealFlavorProfile: { umami: 70, acidity: 40, funk: 10, sweetness: 60, safety: 90 },
    difficulty: 3
  },
  {
    id: "black_apple",
    name: "Black Apple",
    type: "Blackening" /* BLACK */,
    description: "Maillard Reaction. Not fermentation. Pure chemistry. Needs High Temp + High Humidity.",
    requiredIngredients: { substrate: true, starter: null, additive: null },
    // Garlic or Fruit
    outputIngredientId: "black_apple",
    requiredVesselId: "incubator",
    baseDurationSeconds: 200,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Clean",
    idealParams: { temp: 60, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 70, acidity: 40, funk: 20, sweetness: 80, safety: 100 },
    difficulty: 2
  },
  {
    id: "yellow_peaso",
    name: "Pearl Barley Peaso",
    type: "Miso/Paste" /* MISO */,
    description: "The Noma classic. Sweet, grassy, earthy.",
    requiredIngredients: { substrate: true, starter: "barley_koji", additive: "salt" },
    outputIngredientId: "peaso_paste",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 90,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Clean",
    idealParams: { temp: 20, humidity: 55, salinity: 6 },
    idealFlavorProfile: { umami: 60, acidity: 20, funk: 20, sweetness: 50, safety: 100 },
    difficulty: 1
  },
  // --- 5. THE BLACK MARKET ---
  {
    id: "tears_garum",
    name: "Lacryma (The Weeping)",
    type: "Garum" /* GARUM */,
    description: "Saline Balance. Tears are salty. Adding more salt ruins it. Synthesized sorrow.",
    requiredIngredients: { substrate: false, starter: "koji_rice", additive: "salt" },
    // Uses Tears (Additive)
    outputIngredientId: "lacryma_vial",
    requiredVesselId: "incubator",
    baseDurationSeconds: 150,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Skim",
    idealParams: { temp: 37, humidity: 60, salinity: 9 },
    // Body temp
    idealFlavorProfile: { umami: 100, acidity: 10, funk: 10, sweetness: 20, safety: 80 },
    difficulty: 5
  },
  {
    id: "ancient_garum",
    name: "Primordial Garum",
    type: "Bio-Hazard" /* FAIL */,
    // Or Special
    description: "The Gamble. Ancient Spores are volatile. 30% chance of Bio-Hazard.",
    requiredIngredients: { substrate: true, starter: "ancient_spores", additive: null },
    outputIngredientId: "ambrosia",
    requiredVesselId: "onggi",
    baseDurationSeconds: 200,
    peakWindowStart: 95,
    peakWindowEnd: 100,
    activeIntervention: "Flip",
    idealParams: { temp: 30, humidity: 80, salinity: 15 },
    idealFlavorProfile: { umami: 100, acidity: 50, funk: 100, sweetness: 100, safety: 50 },
    difficulty: 5
  },
  {
    id: "casu_marzu",
    name: "Casu Marzu II",
    type: "Miso/Paste" /* MISO */,
    // Cheese
    description: "Hygiene Inversion. Requires LOW HYGIENE to feed the larvae.",
    requiredIngredients: { substrate: true, starter: "fly_larvae", additive: null },
    outputIngredientId: "forbidden_cheese",
    requiredVesselId: "koji_tray",
    // Open tray
    baseDurationSeconds: 100,
    peakWindowStart: 90,
    peakWindowEnd: 100,
    activeIntervention: "Mix",
    idealParams: { temp: 25, humidity: 60, salinity: 5 },
    idealFlavorProfile: { umami: 90, acidity: 80, funk: 100, sweetness: 0, safety: 10 },
    difficulty: 4
  },
  // --- UTILITY / GENERIC ---
  {
    id: "barley_koji",
    name: "Barley Koji",
    type: "Koji Cultivation" /* KOJI */,
    description: "Inoculated grains. Foundation of flavor.",
    requiredIngredients: { substrate: true, starter: "koji_spores", additive: null },
    outputIngredientId: "barley_koji",
    requiredVesselId: "koji_tray",
    baseDurationSeconds: 48,
    peakWindowStart: 85,
    peakWindowEnd: 100,
    activeIntervention: "Flip",
    idealParams: { temp: 34, humidity: 80, salinity: 0 },
    idealFlavorProfile: { umami: 40, acidity: 10, funk: 20, sweetness: 60, safety: 100 },
    difficulty: 1
  },
  {
    id: "shio_koji",
    name: "Shio Koji",
    type: "Koji Cultivation" /* KOJI */,
    description: "Living seasoning paste made from koji, salt, and water. Rich in enzymes that tenderize and enhance umami.",
    requiredIngredients: { substrate: true, starter: "barley_koji", additive: "salt" },
    outputIngredientId: "amino_sauce",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 50,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    idealParams: { temp: 25, humidity: 60, salinity: 12 },
    idealFlavorProfile: { umami: 75, acidity: 20, funk: 30, sweetness: 60, safety: 100 },
    difficulty: 1
  },
  {
    id: "amazake",
    name: "Amazake",
    type: "Koji Cultivation" /* KOJI */,
    description: "Traditional sweet fermented rice/barley drink. Rapid enzymatic breakdown converts starches into rich natural glucose.",
    requiredIngredients: { substrate: true, starter: "barley_koji", additive: "water" },
    outputIngredientId: "amino_sauce",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 45,
    peakWindowStart: 80,
    peakWindowEnd: 95,
    activeIntervention: "Stir",
    idealParams: { temp: 55, humidity: 70, salinity: 0 },
    idealFlavorProfile: { umami: 20, acidity: 10, funk: 10, sweetness: 95, safety: 100 },
    difficulty: 1
  },
  {
    id: "bio_sludge",
    name: "Bio-Sludge",
    type: "Bio-Hazard" /* FAIL */,
    description: "An unrecognizable, rotting mess.",
    requiredIngredients: { substrate: true, starter: null, additive: null },
    outputIngredientId: "bio_sludge",
    requiredVesselId: "mason_jar",
    baseDurationSeconds: 30,
    peakWindowStart: 0,
    peakWindowEnd: 0,
    activeIntervention: "Clean",
    idealParams: { temp: 0, humidity: 0, salinity: 0 },
    idealFlavorProfile: { umami: 0, acidity: 100, funk: 100, sweetness: 0, safety: 0 },
    difficulty: 0
  }
];

// services/gameLogic.ts
var DANGER_TEMP = 42;
var THERMAL_MASS_FACTOR = 120;
var resolveRecipeFromMatrix = (ingredients, vesselId) => {
  ingredients = ingredients.map(
    (i) => i.legitCounterpartId ? { ...i, id: i.legitCounterpartId } : i
  );
  const hasId = (idPart) => ingredients.some((i) => i.id.includes(idPart));
  const sub = ingredients.find((i) => i.type === "SUBSTRATE" /* SUBSTRATE */);
  const hasSalt = hasId("salt");
  const hasSugar = hasId("sugar");
  const hasKoji = ingredients.some((i) => i.id.includes("koji") && !i.id.includes("spores"));
  const hasSpores = hasId("spores");
  const hasChili = hasId("chili") || hasId("pepper");
  const hasWheat = hasId("wheat");
  const hasWater = hasId("water");
  const hasTears = hasId("tears");
  const hasLarvae = hasId("larvae");
  const matrixToken = (t) => {
    if (t === "koji") return hasKoji;
    if (t === "chili") return hasChili;
    return hasId(t);
  };
  const matchSubstrate = (m) => {
    switch (m.kind) {
      case "is":
        return sub?.id === m.id;
      case "oneOf":
        return !!sub && m.ids.includes(sub.id);
      case "includes":
        return !!sub?.id.includes(m.token);
      case "none":
        return !sub;
      case "present":
        return !!sub;
      case "any":
        return true;
    }
  };
  for (const entry of RECIPE_MATRIX) {
    if (entry.vesselId !== null && entry.vesselId !== vesselId) continue;
    if (!matchSubstrate(entry.substrate)) continue;
    if (!entry.requires.every(matrixToken)) continue;
    if (entry.forbids?.some(matrixToken)) continue;
    const found = RECIPES.find((r) => r.id === entry.recipeId);
    if (found) return found;
  }
  if (sub) {
    if (hasSalt && !hasKoji && !hasSugar && !hasSpores && (vesselId === "mason_jar" || vesselId === "onggi")) {
      const isBrine = hasWater;
      return {
        id: `lacto_${sub.id}_gen`,
        name: isBrine ? `Brined ${sub.name.split(" ").pop()}` : `Lacto-Fermented ${sub.name.split(" ").pop()}`,
        type: "Lacto-Fermentation" /* LACTO */,
        description: isBrine ? `Salt-brine pickle. Slower, safer.` : `Dry-salted ${sub.name}. Crisp, acidic, and probiotic.`,
        requiredIngredients: { substrate: true, starter: null, additive: "salt" },
        outputIngredientId: `lacto_${sub.id}`,
        requiredVesselId: vesselId,
        baseDurationSeconds: isBrine ? 80 : 60,
        // Brine is slower
        peakWindowStart: 85,
        peakWindowEnd: 100,
        activeIntervention: "Clean",
        idealParams: { temp: 20, humidity: 60, salinity: 3 },
        idealFlavorProfile: {
          umami: 20,
          acidity: isBrine ? 60 : 80,
          // Brine dilutes acid
          funk: 30,
          sweetness: Math.max(0, sub.hiddenStats.sugarContent * 5),
          safety: isBrine ? 100 : 90
          // Brine is safer
        },
        difficulty: 1
      };
    }
    if (hasKoji && hasSalt && (vesselId === "onggi" || vesselId === "mason_jar" || vesselId === "cedar_barrel")) {
      const isWet = hasWater;
      return {
        id: `miso_${sub.id}_gen`,
        name: isWet ? `Amino Mash (${sub.name.split(" ").pop()})` : `${sub.name.split(" ").pop()} Miso`,
        type: "Miso/Paste" /* MISO */,
        description: isWet ? `Wet mash of ${sub.name}. Can be pressed for sauce.` : `Amino paste made from ${sub.name}. Savory and rich.`,
        requiredIngredients: { substrate: true, starter: "koji", additive: "salt" },
        outputIngredientId: `miso_${sub.id}`,
        requiredVesselId: vesselId,
        baseDurationSeconds: 120,
        peakWindowStart: 90,
        peakWindowEnd: 100,
        activeIntervention: isWet ? "Stir" : "Clean",
        idealParams: { temp: 25, humidity: 60, salinity: 8 },
        idealFlavorProfile: {
          umami: sub.hiddenStats.proteinContent * 10,
          acidity: 20,
          funk: 50,
          sweetness: sub.hiddenStats.sugarContent * 5,
          safety: 100
        },
        difficulty: 2
      };
    }
    if (hasKoji && hasSalt && vesselId === "incubator") {
      return {
        id: `garum_${sub.id}_gen`,
        name: `${sub.name.split(" ").pop()} Garum`,
        // e.g. "Beef Garum"
        type: "Garum" /* GARUM */,
        description: `High-temperature enzymatic breakdown of ${sub.name}. Liquid Umami.`,
        requiredIngredients: { substrate: true, starter: "koji", additive: "salt" },
        outputIngredientId: `garum_${sub.id}`,
        requiredVesselId: vesselId,
        baseDurationSeconds: 150,
        peakWindowStart: 90,
        peakWindowEnd: 100,
        activeIntervention: "Skim",
        idealParams: { temp: 60, humidity: 50, salinity: 15 },
        // Needs high heat
        idealFlavorProfile: {
          umami: sub.hiddenStats.proteinContent * 15,
          // Extreme Umami
          acidity: 30,
          funk: 60,
          sweetness: 10,
          safety: 90
        },
        difficulty: 3
      };
    }
    if (hasSugar && !hasSalt && !hasKoji && vesselId === "mason_jar") {
      return {
        id: `cheong_${sub.id}_gen`,
        name: `${sub.name.split(" ").pop()} Cheong`,
        // e.g. "Plum Cheong"
        type: "Alcoholic Brew" /* ALCOHOL */,
        // Categorized as Alcohol/Syrup class
        description: `Osmotic sugar extraction of ${sub.name}. Intense sweetness and aroma.`,
        requiredIngredients: { substrate: true, starter: null, additive: "sugar" },
        outputIngredientId: `cheong_${sub.id}`,
        requiredVesselId: vesselId,
        baseDurationSeconds: 80,
        peakWindowStart: 85,
        peakWindowEnd: 100,
        activeIntervention: "Ventilate",
        idealParams: { temp: 20, humidity: 50, salinity: 0 },
        idealFlavorProfile: {
          umami: 0,
          acidity: 10,
          funk: 10,
          sweetness: 100,
          safety: 100
        },
        difficulty: 1
      };
    }
    if (!hasSalt && !hasKoji && !hasSugar && vesselId === "incubator") {
      return {
        id: `black_${sub.id}_gen`,
        name: `Black ${sub.name.split(" ").pop()}`,
        // e.g. "Black Garlic"
        type: "Blackening" /* BLACK */,
        description: `Slow Maillard reaction of ${sub.name}. Sweet, savory, and soft.`,
        requiredIngredients: { substrate: true, starter: null, additive: null },
        outputIngredientId: `black_${sub.id}`,
        requiredVesselId: vesselId,
        baseDurationSeconds: 200,
        peakWindowStart: 90,
        peakWindowEnd: 100,
        activeIntervention: "Clean",
        idealParams: { temp: 60, humidity: 80, salinity: 0 },
        idealFlavorProfile: {
          umami: 50,
          acidity: 20,
          funk: 40,
          sweetness: 80,
          safety: 100
        },
        difficulty: 2
      };
    }
  }
  return RECIPES.find((r) => r.id === "bio_sludge");
};
var calculateBatchDynamics = (ingredients, customQuantities) => {
  const getMass = (i) => customQuantities && customQuantities[i.id] !== void 0 ? customQuantities[i.id] : i.mass;
  const totalMass = ingredients.reduce((acc, i) => acc + getMass(i), 0);
  const waterMass = ingredients.filter((i) => i.id === "water").reduce((acc, i) => acc + getMass(i), 0);
  const kojiMass = ingredients.filter((i) => i.id.includes("koji") && !i.id.includes("spores")).reduce((acc, i) => acc + getMass(i), 0);
  const yieldVolume = totalMass / 1e3;
  const solidMass = totalMass - waterMass;
  const concentration = solidMass > 0 ? solidMass / totalMass : 0.1;
  const waterRatio = totalMass > 0 ? waterMass / totalMass : 0;
  const enzymeDensity = kojiMass / (totalMass || 1);
  const speedModifier = 1 + enzymeDensity * 4;
  return { yieldVolume, concentration, speedModifier, totalMass, waterRatio };
};
var getAmbientConditions = (month, weather) => {
  const baseTemp = 18;
  const tempVar = 10;
  let ambientTemp = baseTemp - Math.cos(month / 12 * 2 * Math.PI) * tempVar;
  let ambientHumidity = 45;
  if (month >= 5 && month <= 7) ambientHumidity = 75;
  else if (month >= 11 || month <= 1) ambientHumidity = 30;
  else ambientHumidity = 55;
  ambientTemp += weather.tempModifier;
  ambientHumidity = Math.max(0, Math.min(100, ambientHumidity + weather.humidityModifier));
  return { ambientTemp, ambientHumidity };
};
var processBatchTick = (batch, recipe, hygiene, substrate, ingredients, activeStaff, inventory, currentMonth, weather, isPowerAvailable = true) => {
  const newParams = { ...batch.params };
  const newQuality = { ...batch.quality };
  let messages = [...batch.messages];
  let progress = batch.progress;
  let status = batch.status;
  let stress = batch.stress || 0;
  let disturbanceTimer = batch.disturbanceTimer || 0;
  const flags = batch.flags || { isLidPropped: false };
  let lineageDamaged = batch.lineageDamaged;
  const { speedModifier, concentration, totalMass } = calculateBatchDynamics(ingredients, batch.ingredientQuantities);
  const vessel = VESSELS.find((v) => v.id === batch.vesselId) || VESSELS[0];
  const generation = batch.generation || 1;
  const genBonus = Math.min(10, generation - 1);
  const genSpeedBuff = 1 + genBonus * 0.05;
  const resilienceBuffer = genBonus * 5;
  const isKoji = recipe.type === "Koji Cultivation" /* KOJI */;
  const isIncubated = batch.vesselId === "incubator";
  const isBreathable = batch.vesselId === "koji_tray" || batch.vesselId === "cedar_barrel" || batch.vesselId === "onggi";
  const { ambientTemp, ambientHumidity } = getAmbientConditions(currentMonth, weather);
  if (disturbanceTimer > 0) {
    disturbanceTimer -= 1;
    const passiveCooling = (newParams.temp - ambientTemp) * 0.01;
    newParams.temp -= passiveCooling;
    return { ...batch, params: newParams, disturbanceTimer };
  }
  if (isKoji) {
    let metabolicActivity = 0;
    if (progress < 20) {
      metabolicActivity = 0.1;
    } else if (progress >= 20 && progress < 80) {
      const optimalTemp = recipe.idealParams.temp;
      const tempOptimality = 1 - Math.abs(newParams.temp - optimalTemp) / 25;
      metabolicActivity = Math.max(0, tempOptimality) * 3;
    } else {
      metabolicActivity = 0.2;
    }
    const selfGeneratedHeat = metabolicActivity * 4 * concentration * speedModifier;
    let coolingFactor = 0.02 * (1 - vessel.insulationFactor);
    if (flags.isLidPropped) {
      coolingFactor = 0.3;
    } else {
      coolingFactor *= 0.2;
    }
    if ((inventory["portable_fan"] || 0) > 0) coolingFactor += 0.05;
    const ambientDelta = newParams.temp - ambientTemp;
    const coolingLoss = ambientDelta * coolingFactor;
    const netTempChange = (selfGeneratedHeat - coolingLoss) / (THERMAL_MASS_FACTOR / 10);
    newParams.temp += netTempChange;
    let moistureLoss = 5e-3;
    if (flags.isLidPropped) {
      moistureLoss = 0.2;
    } else {
      moistureLoss = 1e-3;
    }
    if (newParams.temp > 35) moistureLoss += 0.02;
    if ((inventory["humidifier"] || 0) > 0 && newParams.humidity < recipe.idealParams.humidity) {
      moistureLoss -= 0.05;
    }
    newParams.humidity = Math.max(0, newParams.humidity - moistureLoss);
    if (newParams.temp > DANGER_TEMP) {
      const severity = newParams.temp - DANGER_TEMP;
      stress += severity * 0.5;
      lineageDamaged = true;
      if (activeStaff["rd"] && stress >= 75) {
        stress = Math.min(70, stress);
        newParams.temp = Math.max(32, newParams.temp - 4);
        if (!messages.includes("R&D Emergency Tray Turn")) {
          messages.push("R&D Emergency Tray Turn: Burnout Prevented");
        }
      }
      if (stress > 50 && !messages.includes("Warning: Heat Stress")) {
        messages.push("Warning: Heat Stress");
      }
    } else if (newParams.temp < DANGER_TEMP && stress > 0) {
      stress -= 0.2;
    }
    if (stress < 90 && newParams.humidity > 30) {
      const speedMult = 1 + (newParams.temp - 30) / 20;
      const baseGrowth = 100 / recipe.baseDurationSeconds;
      progress += baseGrowth * speedMult * speedModifier * genSpeedBuff;
    }
    if (stress >= 100) {
      status = "spoiled";
      if (!messages.includes("CRITICAL: Burnout")) messages.push("CRITICAL: Burnout");
    }
  } else {
    const thermalInertia = Math.max(1, totalMass / 1e3 * 10);
    let targetTemp = ambientTemp;
    let heatingPower = 0;
    if (isIncubated) {
      if (isPowerAvailable) {
        targetTemp = recipe.idealParams.temp;
        heatingPower = 2;
      } else {
        targetTemp = ambientTemp;
        heatingPower = 0;
        if (Math.random() < 0.1 && !messages.includes("Grid Brownout: Heating Offline")) {
          messages.push("Grid Brownout: Heating Offline");
        }
      }
    }
    const insulationDamping = Math.max(0.2, 1 - vessel.insulationFactor * 0.75);
    const passiveEquilRate = 0.05 * insulationDamping / thermalInertia;
    if (newParams.temp < targetTemp) {
      newParams.temp += heatingPower / thermalInertia + (targetTemp - newParams.temp) * passiveEquilRate;
    } else {
      newParams.temp -= (newParams.temp - targetTemp) * passiveEquilRate;
    }
    if (isBreathable) {
      const drift = (newParams.humidity - ambientHumidity) * 0.01;
      newParams.humidity -= drift;
    }
    if (newParams.temp > 10 && newParams.temp < 65) {
      const tempOptimality = 1 - Math.abs(newParams.temp - recipe.idealParams.temp) / 50;
      progress += 100 / recipe.baseDurationSeconds * speedModifier * genSpeedBuff * Math.max(0.1, tempOptimality);
    }
  }
  let safetyDecay = 0;
  let riskFactor = 1;
  if (isKoji && newParams.temp < 25 && newParams.humidity > 85) {
    if (Math.random() < (100 - hygiene) / 500) {
      safetyDecay += 5;
      if (!messages.includes("Mold Contamination")) messages.push("Mold Contamination");
    }
  }
  if (newParams.temp > 35 && substrate.hiddenStats.fatContent > 4) {
    if (Math.random() < 0.01) {
      riskFactor += 2;
    }
  }
  if (recipe.idealParams.salinity > 0) {
    if (newParams.salinity < recipe.idealParams.salinity * 0.4) {
      safetyDecay += 2;
      if (Math.random() < 0.05 && !messages.includes("Under-salted: Pathogen Risk")) {
        messages.push("Under-salted: Pathogen Risk");
      }
    } else if (newParams.salinity >= recipe.idealParams.salinity * 0.8) {
      riskFactor *= 0.35;
    } else if (newParams.salinity > recipe.idealParams.salinity * 1.8) {
      riskFactor *= 0.1;
    }
  }
  if (newQuality.acidity >= 45) {
    riskFactor *= 0.2;
  }
  if (activeStaff["cleaner"]) riskFactor *= 0.5;
  const adjustedHygiene = Math.min(100, hygiene + resilienceBuffer);
  const contaminationChance = (100 - adjustedHygiene) / 2e3 * riskFactor;
  if (Math.random() < contaminationChance) {
    safetyDecay += 1;
  }
  if (recipe.id === "bottarga") {
    if (newParams.humidity > 40) {
      safetyDecay += 5;
      if (Math.random() < 0.1 && !messages.includes("High Humidity Warning")) messages.push("High Humidity Warning");
    }
  }
  if (recipe.id === "casu_marzu") {
    if (hygiene > 50) {
      progress *= 0.1;
      if (Math.random() < 0.05 && !messages.includes("Larvae Starving")) messages.push("Larvae Starving (Too Clean!)");
    }
  }
  if (recipe.id === "bagoong") {
    if (!flags.isLidPropped) {
      newQuality.funk += 0.1;
      newQuality.umami -= 0.05;
      if (Math.random() < 0.01 && !messages.includes("Anaerobic (Turning Grey)")) messages.push("Anaerobic (Turning Grey)");
    } else {
      newQuality.umami += 0.1;
    }
  }
  if (recipe.id === "cheong") {
    if (hygiene < 50) {
      if (Math.random() < 0.05) {
        newQuality.safety -= 2;
        newQuality.funk += 5;
        if (!messages.includes("Wild Yeast Infection")) messages.push("Wild Yeast Infection");
      }
    }
  }
  if (recipe.id === "gochujang") {
    if (newParams.temp > 30) {
      newQuality.safety -= 1;
      newQuality.sweetness -= 0.5;
      if (Math.random() < 0.05 && !messages.includes("Turning Alcoholic")) messages.push("Turning Alcoholic");
    }
  }
  if (recipe.id === "ancient_garum") {
    if (Math.random() < 0.02) {
      safetyDecay += 50;
      if (!messages.includes("BIO-HAZARD EVENT")) messages.push("BIO-HAZARD EVENT");
    }
  }
  if (recipe.id === "coconut_vin") {
    if (progress < 50) {
      newQuality.sweetness -= 0.2;
    } else {
      newQuality.acidity += 0.2;
    }
  }
  newQuality.safety = Math.max(0, newQuality.safety - safetyDecay);
  const peakStart = recipe.peakWindowStart;
  const peakBonus = activeStaff["chef"] ? Math.round((recipe.peakWindowEnd - recipe.peakWindowStart) * 0.25) : 0;
  const effectivePeakEnd = recipe.peakWindowEnd + peakBonus;
  if (newQuality.safety < 20) {
    status = "spoiled";
  } else if (progress >= effectivePeakEnd + 40) {
    status = "spoiled";
  } else if (progress >= 100 && batch.progress < 100) {
    status = "ready";
    if (!messages.includes("Fermentation Complete (Peak Ready)")) {
      messages.push("Fermentation Complete (Peak Ready)");
    }
  } else if (status !== "spoiled" && status !== "ready") {
    status = "active";
  }
  if (activeStaff["tech"]) {
    if (!isKoji) {
      if (Math.abs(newParams.temp - recipe.idealParams.temp) > 2) {
        newParams.temp += (recipe.idealParams.temp - newParams.temp) * 0.15;
      }
    } else {
      if (newParams.humidity < 60) newParams.humidity += 1.5;
    }
  }
  const rdUmamiMult = activeStaff["rd"] ? 1.35 : 1;
  if (progress < peakStart) {
    newQuality.umami += 0.05 * concentration * rdUmamiMult;
  } else if (progress >= peakStart && progress <= effectivePeakEnd) {
    newQuality.umami += 0.2 * concentration * rdUmamiMult;
    newQuality.funk += 0.1 * concentration;
    newQuality.acidity += 0.05;
  } else if (progress > effectivePeakEnd) {
    newQuality.umami -= 0.1;
    newQuality.funk += 0.2;
  }
  return {
    ...batch,
    totalMass,
    progress,
    params: newParams,
    quality: newQuality,
    status,
    messages: messages.slice(-5),
    lastTick: Date.now(),
    lineageDamaged,
    stress: Math.max(0, stress),
    disturbanceTimer,
    flags
  };
};
var calculateCriticScore = (batch, recipe, activeStaff) => {
  if (recipe.type === "Bio-Hazard" /* FAIL */ || batch.status === "spoiled") return 0;
  const q = batch.quality;
  const t = recipe.idealFlavorProfile;
  let clarityBonus = batch.isFiltered ? 10 : 0;
  const batchIngredients = batch.inputIngredientIds.map((id) => INGREDIENTS.find((i) => i.id === id)).filter(Boolean);
  let avgQuality = 50;
  if (batchIngredients.length > 0) {
    avgQuality = batchIngredients.reduce((acc, i) => acc + i.quality, 0) / batchIngredients.length;
  }
  const diff = Math.abs(q.umami - t.umami) + Math.abs(q.acidity - t.acidity) + Math.abs(q.funk - t.funk) + Math.abs(q.sweetness - t.sweetness);
  let score = Math.max(0, 100 - diff / 3) + clarityBonus;
  if (activeStaff?.rd) score += 5;
  if (activeStaff?.chef) score += 3;
  if (q.safety < 50) score = 0;
  else if (q.safety < 90) score *= q.safety / 100;
  const isPeak = batch.progress >= recipe.peakWindowStart && batch.progress <= recipe.peakWindowEnd;
  if (isPeak) {
    score += 5;
  } else if (batch.progress < recipe.peakWindowStart && batch.status !== "ready" && batch.status !== "analyzed") {
    const completionRatio = Math.max(0.3, batch.progress / Math.max(1, recipe.peakWindowStart));
    score *= completionRatio;
  }
  const qualityCap = 60 + avgQuality * 0.4;
  return Math.floor(Math.min(qualityCap, score));
};
var generateInitialQuality = (ingredients) => {
  const sub = ingredients.find((i) => i.type === "SUBSTRATE" /* SUBSTRATE */) || ingredients[0];
  const { concentration } = calculateBatchDynamics(ingredients);
  return {
    umami: sub.hiddenStats.proteinContent * concentration * 5,
    acidity: 5 * concentration,
    funk: sub.hiddenStats.microbialDiversity * 2 * concentration,
    sweetness: sub.hiddenStats.sugarContent * 2 * concentration,
    safety: 100
  };
};

// sim/variation.ts
var ing = (id) => INGREDIENTS.find((i) => i.id === id);
var NO_STAFF = { cleaner: false, tech: false, chef: false, rd: false };
var WEATHER = { type: "Cloudy", tempModifier: 0, humidityModifier: 0, description: "Overcast" };
function runBatch(ings, vesselId, playPerfect = true) {
  const recipe = resolveRecipeFromMatrix(ings, vesselId);
  const qty = {};
  ings.forEach((i) => {
    qty[i.id] = i.mass;
  });
  const { yieldVolume, totalMass } = calculateBatchDynamics(ings, qty);
  const sub = ings.find((i) => i.type === "SUBSTRATE" /* SUBSTRATE */) || ings[0];
  let b = {
    id: "x",
    recipeId: recipe.id,
    cachedRecipe: recipe,
    substrateId: sub.id,
    starterId: null,
    inputIngredientIds: ings.map((i) => i.id),
    ingredientQuantities: qty,
    totalMass,
    yieldVolume,
    vesselId,
    startTime: 0,
    lastTick: 0,
    progress: 0,
    status: "active",
    // "played perfectly" = dials set to the recipe's own ideal
    params: playPerfect ? { ...recipe.idealParams } : { temp: 25, humidity: 80, salinity: 0 },
    quality: generateInitialQuality(ings),
    messages: [],
    generation: 1,
    lineageDamaged: false,
    stress: 0,
    disturbanceTimer: 0,
    flags: { isLidPropped: false },
    contraband: false
  };
  for (let t = 0; t < 4e3 && b.status === "active"; t++) {
    b = processBatchTick(b, recipe, 100, sub, ings, NO_STAFF, {}, 5, WEATHER, true);
    if (b.progress >= recipe.peakWindowStart) break;
  }
  const score = calculateCriticScore(b, recipe, NO_STAFF);
  return { recipe, batch: b, score };
}
var F = (n) => n.toFixed(0).padStart(4);
console.log("=== A. SAME RECIPE FAMILY, DIFFERENT SUBSTRATE (procedural miso: sub + koji + salt, onggi) ===\n");
console.log(
  "substrate".padEnd(20),
  "prot".padStart(5),
  "sug".padStart(4),
  "div".padStart(4),
  "|",
  "TARGET uma".padStart(11),
  "ACTUAL uma".padStart(11),
  "|",
  "score".padStart(6),
  "recipe"
);
var misoSubs = ["soybeans", "black_soybeans", "yellow_peas", "barley", "glutinous_rice", "mackerel", "anchovies", "raw_milk", "scallops"];
for (const id of misoSubs) {
  const s = ing(id);
  const { recipe, batch, score } = runBatch([s, s, ing("koji_rice"), ing("salt")], "onggi");
  console.log(
    s.name.padEnd(20),
    F(s.hiddenStats.proteinContent),
    F(s.hiddenStats.sugarContent),
    F(s.hiddenStats.microbialDiversity),
    "|",
    F(recipe.idealFlavorProfile.umami).padStart(11),
    F(batch.quality.umami).padStart(11),
    "|",
    String(score).padStart(6),
    recipe.name
  );
}
console.log("\n=== B. SAME SUBSTRATE, DIFFERENT NAMED RECIPES (is the score always the same?) ===\n");
var fixed = [
  ["Colatura", [ing("anchovies"), ing("anchovies"), ing("salt")], "oak_cask"],
  ["Nuoc Mam", [ing("anchovies"), ing("anchovies"), ing("salt")], "cedar_barrel"],
  ["Bottarga", [ing("mullet_roe"), ing("salt")], "koji_tray"],
  ["Garum Sociorum", [ing("mackerel"), ing("mackerel"), ing("salt")], "incubator"],
  ["Hatcho Miso", [ing("soybeans"), ing("soybeans"), ing("koji_spores"), ing("salt")], "cedar_barrel"],
  ["Shiro Miso", [ing("soybeans"), ing("koji_rice"), ing("salt")], "mason_jar"]
];
console.log("recipe".padEnd(18), "resolved as".padEnd(22), "score".padStart(6), "uma".padStart(5), "aci".padStart(5), "fnk".padStart(5), "swt".padStart(5), "saf".padStart(5));
for (const [label, list, v] of fixed) {
  const { recipe, batch, score } = runBatch(list, v);
  const q = batch.quality;
  console.log(
    label.padEnd(18),
    recipe.name.padEnd(22),
    String(score).padStart(6),
    F(q.umami),
    F(q.acidity),
    F(q.funk),
    F(q.sweetness),
    F(q.safety)
  );
}
console.log("\n=== C. DOES PLAYING BADLY ACTUALLY COST YOU? (same inputs, wrong dials) ===\n");
console.log("recipe".padEnd(22), "perfect dials".padStart(14), "default dials".padStart(14), "delta".padStart(7));
for (const [label, list, v] of fixed) {
  const good = runBatch(list, v, true).score;
  const bad = runBatch(list, v, false).score;
  console.log(label.padEnd(22), String(good).padStart(14), String(bad).padStart(14), String(good - bad).padStart(7));
}
