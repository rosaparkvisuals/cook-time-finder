import { useState, useEffect, useRef, useCallback } from "react";

// ─── Method detection ─────────────────────────────────────────────────────────
const METHOD_PATTERNS = {
  oven:       /\b(oven|baked?|roasted?)\b/i,
  airfryer:   /\b(air\s*fry(er)?|airfryer)\b/i,
  instantpot: /\b(instant\s*pot|pressure\s*cooker|\bip\b)\b/i,
  stovetop:   /\b(stovetop|pan|skillet|stove|boil)\b/i,
  grill:      /\b(grill(ed)?|bbq|barbecue)\b/i,
  slowcooker: /\b(slow\s*cooker|crockpot)\b/i,
  microwave:  /\b(microwave)\b/i,
};

function detectMethod(q) {
  for (const [method, re] of Object.entries(METHOD_PATTERNS)) {
    if (re.test(q)) return method;
  }
  return null;
}

function normalize(s) {
  return s.toLowerCase()
    .replace(/cook\s*time|cooking\s*time|cooktime|how\s*long|how\s+do\s+i\s+cook|internal\s*temp(erature)?/gi, "")
    .replace(/\s+/g, " ").trim();
}

// Extract lowest number from a time string like "12–16 min" → 12
function extractMinutes(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ─── Seed DB ──────────────────────────────────────────────────────────────────
const SEED_DB = [
  {
    id: "chicken-thigh",
    keywords: ["chicken thigh", "chicken thighs"],
    relatedIds: ["chicken-breast"],
    methods: {
      oven: {
        bullets: ["Boneless thighs: 425°F for 20–25 min", "Bone-in thighs: 425°F for 35–45 min"],
        notes: ["Rest 5 min before serving"],
        foodSafety: "Cook to 165°F minimum. Thighs taste best at 175–185°F.",
        timerMin: 20,
      },
      airfryer: {
        bullets: ["Boneless thighs: 380–400°F for 12–16 min", "Bone-in thighs: 380–400°F for 20–28 min"],
        notes: ["Flip halfway through", "Check early for small thighs"],
        foodSafety: "Cook to 165°F minimum.",
        timerMin: 12,
      },
      instantpot: {
        bullets: ["Boneless: High Pressure 8–10 min", "Bone-in: High Pressure 10–12 min", "Natural release 5 min"],
        notes: ["Add ½ cup liquid minimum"],
        foodSafety: "Cook to 165°F minimum.",
        timerMin: 8,
      },
      stovetop: {
        bullets: ["Boneless: medium-high, 6–8 min per side", "Bone-in: medium, 10–12 min per side, lid on"],
        foodSafety: "Cook to 165°F minimum.",
        timerMin: 6,
      },
      grill: {
        bullets: ["Boneless: medium-high, 6–7 min per side", "Bone-in: indirect 30–40 min, then sear"],
        notes: ["Rest 5 min before serving"],
        foodSafety: "Cook to 165°F minimum.",
        timerMin: 6,
      },
    },
    ambiguous: {
      intro: "Chicken thighs cook differently depending on method and cut.",
      table: {
        headers: ["Method", "Boneless", "Bone-in", "Temp", "Internal"],
        rows: [
          ["Oven",        "20–25 min",     "35–45 min",     "425°F",         "165°F+"],
          ["Air fryer",   "12–16 min",     "20–28 min",     "380–400°F",     "165°F+"],
          ["Instant Pot", "8–10 min",      "10–12 min",     "High Pressure", "165°F+"],
          ["Stovetop",    "6–8 min/side",  "10–12 min/side","Med-high",      "165°F+"],
          ["Grill",       "6–7 min/side",  "30–40 min",     "Med-high",      "165°F+"],
        ],
      },
      foodSafety: "Cook to 165°F minimum. Thighs taste best at 175–185°F.",
      followUp: "Want this adjusted for a specific method?",
      timerMin: 20,
    },
    adjustments: ["Boneless", "Bone-in", "Oven", "Air Fryer", "Instant Pot", "Grill", "Celsius"],
  },
  {
    id: "chicken-breast",
    keywords: ["chicken breast", "chicken breasts"],
    relatedIds: ["chicken-thigh"],
    methods: {
      oven: {
        bullets: ["Boneless: 425°F for 18–22 min", "Bone-in: 400°F for 35–45 min"],
        notes: ["Rest 5 min before slicing to retain juices"],
        foodSafety: "Cook to 165°F internal temperature.",
        timerMin: 18,
      },
      airfryer: {
        bullets: ["375°F for 14–18 min (boneless)", "Flip halfway through"],
        notes: ["Pound to even thickness for uniform cooking"],
        foodSafety: "Cook to 165°F internal temperature.",
        timerMin: 14,
      },
      stovetop: {
        bullets: ["Medium-high, 6–7 min per side (boneless)", "Cover last 2 min to cook through"],
        notes: ["Rest 5 min before slicing"],
        foodSafety: "Cook to 165°F internal temperature.",
        timerMin: 6,
      },
      grill: {
        bullets: ["Medium-high, 6–8 min per side (boneless)", "Rest 5 min before slicing"],
        foodSafety: "Cook to 165°F internal temperature.",
        timerMin: 6,
      },
    },
    ambiguous: {
      intro: "Chicken breast timing depends on method and cut.",
      table: {
        headers: ["Method", "Boneless", "Bone-in", "Temp", "Internal"],
        rows: [
          ["Oven",       "18–22 min",    "35–45 min", "400–425°F", "165°F"],
          ["Air fryer",  "14–18 min",    "—",         "375°F",     "165°F"],
          ["Stovetop",   "6–7 min/side", "—",         "Med-high",  "165°F"],
          ["Grill",      "6–8 min/side", "—",         "Med-high",  "165°F"],
        ],
      },
      foodSafety: "Cook to 165°F internal temperature.",
      followUp: "Which method are you using?",
      timerMin: 18,
    },
    adjustments: ["Boneless", "Bone-in", "Oven", "Air Fryer", "Grill", "Celsius"],
  },
  {
    id: "steak",
    keywords: ["steak", "ribeye", "sirloin", "new york strip"],
    relatedIds: [],
    methods: {
      grill: {
        bullets: ["Rare: 2–3 min/side · Med-rare: 3–4 min/side · Medium: 4–5 min/side", "1-inch steak at high heat", "Rest 5 min before cutting"],
        notes: ["Use a thermometer — colour is unreliable"],
        foodSafety: "Whole cuts: 145°F with 3-min rest (med-rare ~130–135°F for preference).",
        timerMin: 3,
      },
      stovetop: {
        bullets: ["Cast iron at high heat", "Rare: 2 min/side · Med-rare: 3 min/side · Medium: 4 min/side", "Baste with butter, garlic, thyme"],
        notes: ["Let steak come to room temp 30 min before cooking", "Rest 5 min"],
        foodSafety: "Whole cuts: 145°F with 3-min rest.",
        timerMin: 3,
      },
      oven: {
        bullets: ["Reverse sear: 250°F until 10°F below target, then sear 1–2 min/side", "Good for thick steaks (1.5+ inches)"],
        notes: ["Target 125°F in oven for med-rare, then sear"],
        foodSafety: "Final temp 145°F with 3-min rest.",
        timerMin: 20,
      },
    },
    ambiguous: {
      intro: "Steak time depends on thickness, method, and preferred doneness.",
      table: {
        headers: ["Doneness", "Internal Temp", "Grill/Pan Time (1\")"],
        rows: [
          ["Rare",        "125°F / 52°C", "2 min/side"],
          ["Med-rare",    "130°F / 54°C", "3 min/side"],
          ["Medium",      "140°F / 60°C", "4 min/side"],
          ["Med-well",    "150°F / 66°C", "5 min/side"],
          ["Well done",   "160°F / 71°C", "6+ min/side"],
        ],
      },
      foodSafety: "USDA minimum for whole cuts is 145°F with a 3-min rest.",
      followUp: "Want times for a specific thickness or method?",
      timerMin: 3,
    },
    adjustments: ["Rare", "Medium", "Well Done", "Grill", "Stovetop", "Celsius"],
  },
  {
    id: "salmon",
    keywords: ["salmon"],
    relatedIds: [],
    methods: {
      oven: {
        bullets: ["400°F for 12–15 min per inch of thickness", "Done when flesh flakes easily"],
        foodSafety: "FDA recommends 145°F. Many prefer 125–130°F for moist texture.",
        timerMin: 12,
      },
      airfryer: {
        bullets: ["375°F for 8–10 min", "No need to flip"],
        notes: ["Check at 8 min — goes overdone fast"],
        foodSafety: "FDA recommends 145°F internal temp.",
        timerMin: 8,
      },
      stovetop: {
        bullets: ["Medium-high, skin-side down 4–5 min", "Flip and cook 2–3 min more"],
        notes: ["Press down gently at start for crispy skin"],
        foodSafety: "FDA recommends 145°F internal temp.",
        timerMin: 4,
      },
      grill: {
        bullets: ["Medium-high, 3–4 min per side", "Oil grate well to prevent sticking"],
        foodSafety: "FDA recommends 145°F internal temp.",
        timerMin: 3,
      },
    },
    ambiguous: {
      intro: "Salmon cooks quickly — method matters most.",
      table: {
        headers: ["Method", "Time", "Temp", "Internal"],
        rows: [
          ["Oven",      "12–15 min/inch", "400°F",   "145°F"],
          ["Air fryer", "8–10 min",       "375°F",   "145°F"],
          ["Stovetop",  "4–5 min/side",   "Med-high","145°F"],
          ["Grill",     "3–4 min/side",   "Med-high","145°F"],
        ],
      },
      foodSafety: "FDA recommends 145°F. Many prefer 125–130°F for moist texture.",
      followUp: "How are you cooking it?",
      timerMin: 8,
    },
    adjustments: ["Oven", "Air Fryer", "Grill", "Stovetop", "Celsius", "Fahrenheit"],
  },
  {
    id: "pork-tenderloin",
    keywords: ["pork tenderloin", "pork loin"],
    relatedIds: [],
    methods: {
      oven: {
        bullets: ["425°F for 20–25 min (1 lb tenderloin)", "Sear in oven-safe pan first for best crust", "Rest 5–10 min before slicing"],
        foodSafety: "Cook to 145°F internal temp with 3-min rest. Slight pink is safe.",
        timerMin: 20,
      },
      grill: {
        bullets: ["Medium-high, sear all sides ~2 min each", "Then indirect heat until 145°F internal (~15–20 min total)"],
        notes: ["Rest 5 min before slicing"],
        foodSafety: "Cook to 145°F with 3-min rest.",
        timerMin: 15,
      },
    },
    ambiguous: {
      intro: "Pork tenderloin is lean and cooks quickly — don't overcook it.",
      table: {
        headers: ["Method", "Time", "Temp", "Internal"],
        rows: [
          ["Oven (425°F)", "20–25 min", "425°F",   "145°F"],
          ["Grill",        "15–20 min", "Med-high", "145°F"],
        ],
      },
      foodSafety: "Cook to 145°F with a 3-min rest. A slight blush of pink is safe.",
      followUp: "Oven or grill?",
      timerMin: 20,
    },
    adjustments: ["Oven", "Grill", "Celsius"],
  },
  {
    id: "eggs",
    keywords: ["egg", "eggs", "hard boiled egg", "hard-boiled egg", "boiled egg", "soft boiled", "scrambled egg", "fried egg"],
    relatedIds: [],
    ambiguous: {
      intro: "Egg cook times vary a lot by style.",
      table: {
        headers: ["Style", "Time", "Method", "Notes"],
        rows: [
          ["Soft boiled",  "6–7 min",   "Simmer + ice bath", "Runny yolk"],
          ["Jammy",        "7–8 min",   "Simmer + ice bath", "Set whites, soft yolk"],
          ["Hard boiled",  "10–12 min", "Simmer + ice bath", "Fully set"],
          ["Scrambled",    "2–3 min",   "Low-med stovetop",  "Pull off heat early"],
          ["Fried (sunny)","2–3 min",   "Med stovetop",      "Lid on for set whites"],
          ["Poached",      "3–4 min",   "Simmering water",   "Add vinegar to water"],
        ],
      },
      foodSafety: "Cook whites fully set for safety. Runny yolks carry a small salmonella risk.",
      followUp: "What style are you going for?",
      timerMin: 7,
    },
    adjustments: ["Soft Boiled", "Hard Boiled", "Scrambled", "Fried"],
  },
  {
    id: "potato",
    keywords: ["potato", "potatoes", "baked potato"],
    relatedIds: ["sweet-potato"],
    methods: {
      oven: {
        bullets: ["Whole baked: 400°F for 45–60 min", "Cubed/wedges: 425°F for 25–35 min", "Flip cubes halfway"],
        notes: ["Pierce whole potatoes before baking"],
        timerMin: 25,
      },
      airfryer: {
        bullets: ["Cubed: 400°F for 15–20 min, shake halfway", "Whole: 400°F for 35–40 min"],
        notes: ["Single layer only for cubes"],
        timerMin: 15,
      },
      stovetop: {
        bullets: ["Boiling whole: 20–30 min in salted water", "Cubed: 10–15 min", "Start in cold water"],
        timerMin: 10,
      },
      instantpot: {
        bullets: ["Whole: High Pressure 12–15 min + quick release", "Cubed: 5–7 min + quick release"],
        notes: ["Use 1 cup water in pot"],
        timerMin: 5,
      },
    },
    ambiguous: {
      intro: "Potatoes cook differently by cut and method.",
      table: {
        headers: ["Method", "Whole", "Cubed", "Temp"],
        rows: [
          ["Oven",        "45–60 min", "25–35 min", "400–425°F"],
          ["Air fryer",   "35–40 min", "15–20 min", "400°F"],
          ["Boiling",     "20–30 min", "10–15 min", "Boiling water"],
          ["Instant Pot", "12–15 min", "5–7 min",   "High Pressure"],
        ],
      },
      followUp: "Baking, boiling, or air fryer?",
      timerMin: 15,
    },
    adjustments: ["Oven", "Air Fryer", "Boiling", "Instant Pot", "Whole", "Cubed"],
  },
  {
    id: "sweet-potato",
    keywords: ["sweet potato", "sweet potatoes"],
    relatedIds: ["potato"],
    methods: {
      oven: {
        bullets: ["Whole: 425°F for 45–60 min", "Cubed: 425°F for 20–25 min", "Halved: 425°F for 30–40 min"],
        notes: ["Done when easily pierced with a fork", "Flip cubes halfway"],
        timerMin: 20,
      },
      airfryer: {
        bullets: ["Cubed: 375–400°F for 12–15 min", "Shake halfway"],
        notes: ["Single layer only"],
        timerMin: 12,
      },
      microwave: {
        bullets: ["Pierce skin, microwave on High for 5–8 min", "Flip halfway, check at 5 min"],
        timerMin: 5,
      },
    },
    ambiguous: {
      intro: "Sweet potatoes cook differently by method and cut.",
      table: {
        headers: ["Method", "Whole", "Cubed", "Temp"],
        rows: [
          ["Oven",      "45–60 min", "20–25 min", "425°F"],
          ["Air fryer", "—",         "12–15 min", "375–400°F"],
          ["Microwave", "5–8 min",   "—",         "High"],
        ],
      },
      followUp: "Oven, air fryer, or microwave?",
      timerMin: 12,
    },
    adjustments: ["Oven", "Air Fryer", "Microwave", "Whole", "Cubed"],
  },
  {
    id: "broccoli",
    keywords: ["broccoli"],
    relatedIds: ["carrots"],
    methods: {
      oven: {
        bullets: ["425°F for 18–22 min", "Florets should be well-spaced on the pan", "Done when edges are crispy and stems tender"],
        notes: ["Toss with oil and salt before roasting"],
        timerMin: 18,
      },
      airfryer: {
        bullets: ["375°F for 8–10 min", "Shake halfway"],
        notes: ["Works best with dry florets"],
        timerMin: 8,
      },
      stovetop: {
        bullets: ["Blanch: 2–3 min in boiling salted water", "Steam: 4–5 min over simmering water"],
        timerMin: 3,
      },
    },
    ambiguous: {
      intro: "Broccoli is quick to cook — method changes the texture a lot.",
      table: {
        headers: ["Method", "Time", "Temp", "Notes"],
        rows: [
          ["Oven roast", "18–22 min", "425°F",   "Crispy edges"],
          ["Air fryer",  "8–10 min",  "375°F",   "Shake halfway"],
          ["Blanch",     "2–3 min",   "Boiling",  "Bright green"],
          ["Steam",      "4–5 min",   "Simmer",   "Tender"],
        ],
      },
      followUp: "Roasting or steaming?",
      timerMin: 8,
    },
    adjustments: ["Oven", "Air Fryer", "Blanch", "Steam"],
  },
  {
    id: "carrots",
    keywords: ["carrot", "carrots"],
    relatedIds: ["broccoli"],
    methods: {
      oven: {
        bullets: ["400–425°F for 25–35 min", "Sliced coins take less time than whole", "Toss with oil, salt, pepper"],
        timerMin: 25,
      },
      airfryer: {
        bullets: ["380°F for 12–15 min", "Shake halfway"],
        timerMin: 12,
      },
    },
    ambiguous: {
      intro: "Carrots roast well — size and method affect time most.",
      table: {
        headers: ["Method", "Sliced", "Whole baby", "Temp"],
        rows: [
          ["Oven",      "20–25 min", "30–35 min", "400–425°F"],
          ["Air fryer", "10–12 min", "14–16 min", "380°F"],
          ["Boiling",   "8–10 min",  "12–15 min", "Boiling water"],
        ],
      },
      timerMin: 20,
    },
    adjustments: ["Oven", "Air Fryer", "Whole", "Sliced"],
  },
  {
    id: "frozen-fries",
    keywords: ["frozen fries", "air fry fries", "french fries", "frozen chips"],
    relatedIds: ["frozen-pizza"],
    methods: {
      airfryer: {
        bullets: ["400°F for 12–18 min", "Shake basket halfway", "Single layer only — don't overcrowd"],
        notes: ["Thin fries ~12 min · thick steak fries ~18 min"],
        timerMin: 12,
      },
      oven: {
        bullets: ["425°F for 20–25 min", "Flip halfway", "Single layer on a baking sheet"],
        timerMin: 20,
      },
    },
    ambiguous: {
      intro: "Frozen fries are easy — air fryer is fastest and crispiest.",
      table: {
        headers: ["Method", "Time", "Temp", "Notes"],
        rows: [
          ["Air fryer", "12–18 min", "400°F", "Shake halfway, single layer"],
          ["Oven",      "20–25 min", "425°F", "Flip halfway"],
        ],
      },
      timerMin: 12,
    },
    adjustments: ["Air Fryer", "Oven"],
  },
  {
    id: "frozen-pizza",
    keywords: ["frozen pizza"],
    relatedIds: ["frozen-fries"],
    methods: {
      oven: {
        bullets: ["Follow package (usually 375–425°F for 12–20 min)", "Place directly on rack for crispier crust", "Check at minimum time — ovens vary"],
        timerMin: 12,
      },
      airfryer: {
        bullets: ["375°F for 6–10 min (personal/mini pizzas)", "Check at 6 min", "May need to cook in stages for larger pizzas"],
        timerMin: 6,
      },
    },
    ambiguous: {
      intro: "Frozen pizza: follow the package, but here are general guides.",
      table: {
        headers: ["Method", "Temp", "Time", "Notes"],
        rows: [
          ["Oven",     "375–425°F", "12–20 min", "Check package"],
          ["Air fryer","375°F",     "6–10 min",  "Mini/personal only"],
        ],
      },
      timerMin: 12,
    },
    adjustments: ["Oven", "Air Fryer"],
  },
  {
    id: "soaked-chickpea",
    keywords: ["soaked chickpea", "soaked chick pea"],
    relatedIds: ["unsoaked-chickpea"],
    bullets: ["High Pressure for 8–12 min", "Natural release for 10 min", "3 cups water per 1 cup chickpeas"],
    notes: ["Natural release gives better texture"],
    timerMin: 8,
    adjustments: ["Instant Pot", "Stovetop"],
  },
  {
    id: "unsoaked-chickpea",
    keywords: ["unsoaked chickpea", "chickpea", "chick pea"],
    relatedIds: ["soaked-chickpea"],
    bullets: ["High Pressure for 35–40 min", "Natural release for 15 min"],
    notes: ["Soaking first cuts cook time by ~75%"],
    timerMin: 35,
    adjustments: ["Soaked", "Instant Pot", "Stovetop"],
  },
  {
    id: "lentils",
    keywords: ["lentil", "lentils", "red lentil", "green lentil", "brown lentil", "kidney bean", "white kidney bean", "black bean", "navy bean"],
    relatedIds: [],
    ambiguous: {
      intro: "Lentil and bean cook times vary by type.",
      table: {
        headers: ["Type", "Stovetop", "Instant Pot", "Notes"],
        rows: [
          ["Red lentils",    "15–20 min",  "5 min HP",   "Get mushy — great for soup"],
          ["Green/Brown",    "25–35 min",  "8–10 min HP","Hold shape better"],
          ["Black beans",    "60–90 min",  "25–30 min HP","Soak overnight to speed up"],
          ["Kidney beans",   "60–90 min",  "25–30 min HP","Must boil 10 min first — toxic raw"],
          ["White kidney",   "60–90 min",  "25–30 min HP","Same as kidney"],
          ["Navy beans",     "45–60 min",  "20–25 min HP","Great for baked beans"],
          ["Chickpeas",      "60–90 min",  "35–40 min HP","Soak to cut time in half"],
        ],
      },
      foodSafety: "Kidney beans must be boiled vigorously for 10 min before slow cooking — they contain a toxin that slow cookers don't destroy.",
      followUp: "Which type are you cooking?",
      timerMin: 20,
    },
    adjustments: ["Stovetop", "Instant Pot", "Soaked", "Unsoaked"],
  },
  {
    id: "rice",
    keywords: ["white rice", "rice ratio", "rice stovetop", "brown rice", "rice"],
    relatedIds: [],
    ambiguous: {
      intro: "Rice ratio and time depend on the type.",
      table: {
        headers: ["Type", "Water Ratio", "Time", "Rest"],
        rows: [
          ["White (long grain)", "1 : 1¼",  "15 min simmer", "10 min off heat"],
          ["Brown rice",         "1 : 2",   "45 min simmer", "10 min off heat"],
          ["Basmati",            "1 : 1½",  "12 min simmer", "5 min off heat"],
          ["Instant Pot white",  "1 : 1",   "3 min HP",      "10 min NR"],
          ["Instant Pot brown",  "1 : 1¼",  "22 min HP",     "10 min NR"],
        ],
      },
      notes: ["Don't lift the lid during rest", "Rinse rice until water runs clear for fluffier results"],
      timerMin: 15,
    },
    adjustments: ["White Rice", "Brown Rice", "Basmati", "Instant Pot"],
  },
  {
    id: "buttermilk-sub",
    keywords: ["buttermilk substitute", "buttermilk replacement", "no buttermilk"],
    relatedIds: [],
    bullets: ["1 cup milk + 1 tbsp lemon juice or white vinegar", "Stir, sit 5–10 min until slightly curdled", "Use 1:1 in any baking recipe"],
    notes: ["Whole milk gives best results"],
  },
  {
    id: "pasta-salt",
    keywords: ["pasta water", "pasta salt", "salt pasta"],
    relatedIds: [],
    bullets: ["1 tbsp salt per gallon of water", "Water should taste like mild seawater"],
    notes: ["Under-salting is the most common pasta mistake"],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────
function findSeedEntry(question) {
  const q = normalize(question);
  for (const entry of SEED_DB) {
    if (entry.keywords.some((kw) => q.includes(kw.toLowerCase()))) return entry;
  }
  return null;
}

function findRelatedFromSeed(entry) {
  if (!entry?.relatedIds?.length) return [];
  return entry.relatedIds
    .map((id) => SEED_DB.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => ({
      title: e.keywords[0].replace(/\b\w/g, (c) => c.toUpperCase()),
      bullets: e.bullets,
      notes: e.notes,
      foodSafety: e.foodSafety,
    }));
}

function resolveSeedAnswer(question) {
  const entry = findSeedEntry(question);
  if (!entry) return null;
  const method = detectMethod(question);
  if (entry.methods) {
    if (method && entry.methods[method]) {
      return {
        question,
        ...entry.methods[method],
        adjustments: entry.adjustments,
        related: findRelatedFromSeed(entry),
      };
    }
    if (method && !entry.methods[method]) return null; // defer to Claude
    if (entry.ambiguous) {
      return {
        question,
        ...entry.ambiguous,
        adjustments: entry.adjustments,
        related: findRelatedFromSeed(entry),
      };
    }
  }
  if (method) return null;
  return {
    question,
    ...entry,
    adjustments: entry.adjustments,
    related: findRelatedFromSeed(entry),
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a concise cooking-time and temperature reference assistant. Answer with quick, practical facts only. No recipe blog content, stories, intros, or background.

If the food is clear but the method is missing: return a multi-method comparison table. If the method is specified: answer only for that method.

Always include time, temperature, and internal temperature where relevant. For meat, poultry, seafood, eggs, and leftovers always include a food safety note.

Structure for ambiguous queries:
- "intro": one short sentence
- "table": comparison table with headers and rows
- "foodSafety": if relevant
- "followUp": one short question
- "adjustments": array of useful modifier chips e.g. ["Boneless","Air Fryer","Celsius"]

Structure for specific method:
- "bullets": 2–4 short facts
- "notes": max 2 tips
- "foodSafety": if relevant
- "adjustments": array of useful modifier chips
- "timerMin": lowest cook time in minutes as a number

Respond ONLY with valid JSON, no markdown fences:
{
  "intro": "",
  "bullets": [],
  "table": { "headers": [], "rows": [] },
  "notes": [],
  "foodSafety": "",
  "followUp": "",
  "adjustments": [],
  "timerMin": null,
  "related": [{ "title": "", "bullets": [], "notes": [] }]
}

Omit keys that are not needed. Use "table" for multi-method, "bullets" for single-method — never both.
If the question is not about cooking or food: {"offTopic": true}`;

async function askClaude(question) {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!response.ok) throw new Error("API error");
  const data = await response.json();
  const text = data?.content?.[0]?.text || data?.content?.find?.((b) => b.type === "text")?.text || "";
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch { return { bullets: [text], notes: [] }; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const OFF_TOPIC_MSG = "Do you have a cooking question I can help with?";
const NO_AI_MSG = "Do you have a cooking question I can help with?";

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const HERO_CHIPS = ["Chicken Thighs", "Salmon", "Eggs", "Steak", "Potatoes", "Chickpeas", "Frozen Fries", "Air Fryer"];
const ADJUSTMENT_LABELS = ["Boneless", "Bone-in", "Frozen", "Fresh", "Oven", "Air Fryer", "Instant Pot", "Grill", "Stovetop", "Celsius", "Fahrenheit", "Rare", "Medium", "Well Done", "Soaked", "Unsoaked", "Soft Boiled", "Hard Boiled", "Scrambled", "Fried", "White Rice", "Brown Rice", "Basmati", "Whole", "Cubed", "Sliced", "Blanch", "Steam"];

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #F7F2EB;
    --surface: #FDFAF6;
    --border: #E2D8CC;
    --border-light: #EDE6DC;
    --accent: #B84016;
    --accent-hover: #962F0E;
    --accent-muted: #F5EBE5;
    --ink: #1C1208;
    --ink-mid: #4A3728;
    --ink-muted: #8C7060;
    --ink-faint: #BFB0A0;
    --red: #9B2020;
    --red-bg: #FDF4F4;
    --sage: #3D6040;
    --amber: #7A5C1E;
    --amber-bg: #FDF8EE;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  .app { min-height: 100vh; max-width: 620px; margin: 0 auto; padding: 0 0 6rem; }

  /* ─── Header / Hero ─── */
  .header {
    padding: 2.5rem 1.75rem 2rem;
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 2rem;
  }

  .header h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.875rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin-bottom: 0.5rem;
  }

  .header-sub {
    font-size: 0.9rem;
    color: var(--ink-muted);
    font-weight: 300;
    line-height: 1.55;
    max-width: 440px;
  }

  .app-body { padding: 0 1.75rem; }

  /* ─── Input ─── */
  .input-wrap { margin-bottom: 2rem; }
  .input-row { display: flex; gap: 8px; align-items: flex-end; }

  .question-input {
    flex: 1;
    font-family: 'DM Sans', sans-serif;
    font-size: 1rem;
    font-weight: 300;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.8125rem 1rem;
    resize: none; outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    line-height: 1.5; min-height: 50px; max-height: 120px;
  }
  .question-input::placeholder { color: var(--ink-faint); font-weight: 300; }
  .question-input:focus { border-color: var(--ink-mid); box-shadow: 0 0 0 3px rgba(28,18,8,0.06); }

  .icon-btn {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; width: 42px; height: 42px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s; flex-shrink: 0; font-size: 0.9375rem; color: var(--ink-muted);
  }
  .icon-btn:hover { border-color: var(--ink-mid); color: var(--ink); }
  .icon-btn.recording { background: var(--accent); border-color: var(--accent); color: white; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(184,64,22,0.3)} 50%{box-shadow:0 0 0 7px rgba(184,64,22,0)} }

  .ask-btn {
    background: var(--ink); color: #F7F2EB; border: none; border-radius: 8px;
    padding: 0 1.25rem; height: 42px;
    font-family: 'DM Sans', sans-serif; font-size: 0.875rem; font-weight: 500;
    letter-spacing: 0.03em; cursor: pointer; transition: background 0.2s; flex-shrink: 0;
  }
  .ask-btn:hover { background: var(--ink-mid); }
  .ask-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .listening-note { font-size: 0.78rem; color: var(--accent); margin-top: 0.5rem; display: flex; align-items: center; gap: 5px; }
  .listening-dot { width: 5px; height: 5px; background: var(--accent); border-radius: 50%; animation: blink 1s infinite; flex-shrink: 0; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }

  /* ─── Chips (hero + adjustment) ─── */
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.875rem; }

  .chip {
    background: transparent; border: 1px solid var(--border); border-radius: 100px;
    padding: 0.2rem 0.75rem; font-size: 0.775rem; color: var(--ink-muted);
    cursor: pointer; transition: all 0.18s; font-family: 'DM Sans', sans-serif;
    font-weight: 400; letter-spacing: 0.01em;
  }
  .chip:hover { border-color: var(--ink-mid); color: var(--ink); background: rgba(28,18,8,0.04); }

  .adj-chip {
    background: var(--accent-muted); border: 1px solid rgba(184,64,22,0.2);
    border-radius: 100px; padding: 0.2rem 0.75rem;
    font-size: 0.775rem; color: var(--accent); cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; font-weight: 500;
  }
  .adj-chip:hover { background: var(--accent); color: white; border-color: var(--accent); }

  /* ─── Answer block ─── */
  .answer-block { margin-bottom: 2rem; }

  .answer-q {
    font-size: 0.72rem; color: var(--ink-faint);
    letter-spacing: 0.09em; text-transform: uppercase;
    font-weight: 500; margin-bottom: 1.25rem;
  }

  .answer-intro {
    font-size: 0.9375rem; color: var(--ink-muted); line-height: 1.65;
    margin-bottom: 1.25rem; font-weight: 300; font-style: italic;
  }

  .answer-bullets { list-style: none; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .answer-bullet { display: flex; align-items: flex-start; gap: 0.875rem; font-size: 1rem; line-height: 1.55; color: var(--ink); }
  .bullet-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 0.6em; }

  /* ─── Table ─── */
  .compare-table-wrap { overflow-x: auto; margin-bottom: 1.25rem; border-radius: 6px; border: 1px solid var(--border-light); }
  .compare-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .compare-table th {
    text-align: left; padding: 0.5rem 0.875rem;
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.09em;
    font-weight: 500; color: var(--ink-faint);
    background: rgba(28,18,8,0.025); border-bottom: 1px solid var(--border-light);
  }
  .compare-table td { padding: 0.625rem 0.875rem; color: var(--ink); border-bottom: 1px solid var(--border-light); line-height: 1.4; }
  .compare-table tr:last-child td { border-bottom: none; }
  .compare-table td:first-child { font-weight: 500; color: var(--ink-mid); white-space: nowrap; }

  /* ─── Notes ─── */
  .notes-list { list-style: none; margin-bottom: 1.125rem; border-top: 1px solid var(--border-light); padding-top: 0.875rem; }
  .notes-list li { font-size: 0.875rem; color: var(--ink-muted); line-height: 1.6; padding: 0.175rem 0 0.175rem 1rem; position: relative; font-weight: 300; }
  .notes-list li::before { content: "—"; position: absolute; left: 0; color: var(--ink-faint); font-size: 0.75rem; top: 0.32em; }

  /* ─── Food safety ─── */
  .food-safety {
    font-size: 0.8125rem; color: var(--red); line-height: 1.6;
    margin-bottom: 1.125rem; display: flex; gap: 0.5rem; align-items: flex-start;
    padding: 0.75rem 0.875rem; background: var(--red-bg); border-radius: 6px; font-weight: 300;
  }
  .safety-icon { flex-shrink: 0; font-size: 0.75rem; margin-top: 0.15em; }

  /* ─── Timer ─── */
  .timer-wrap { margin-bottom: 1.125rem; }

  .timer-btn {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 0.5rem 1rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem; color: var(--ink-mid); cursor: pointer;
    transition: all 0.18s; font-weight: 400; display: inline-flex; align-items: center; gap: 0.5rem;
  }
  .timer-btn:hover { border-color: var(--ink-mid); color: var(--ink); }
  .timer-btn.running { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }

  .timer-display {
    display: inline-flex; align-items: center; gap: 0.875rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 0.625rem 1rem;
    font-size: 1.5rem; font-weight: 500; color: var(--ink); letter-spacing: 0.05em;
    font-variant-numeric: tabular-nums;
  }

  .timer-display.done { border-color: var(--sage); color: var(--sage); background: #F0F7F1; }

  .timer-control {
    background: none; border: none; cursor: pointer;
    font-size: 0.8rem; color: var(--ink-faint); padding: 0 0.25rem;
    transition: color 0.15s; font-family: 'DM Sans', sans-serif;
  }
  .timer-control:hover { color: var(--ink); }

  .timer-done-msg { font-size: 0.875rem; color: var(--sage); font-weight: 500; margin-top: 0.375rem; }

  /* ─── Adjustment chips ─── */
  .adj-section { margin-bottom: 1.125rem; }
  .adj-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--ink-faint); font-weight: 500; margin-bottom: 0.5rem; }

  /* ─── Follow-up ─── */
  .follow-up-text { font-size: 0.875rem; color: var(--ink-muted); margin-bottom: 1rem; font-style: italic; font-weight: 300; padding-left: 0.875rem; border-left: 2px solid var(--border); }

  /* ─── Related ─── */
  .related-section { margin-top: 1.75rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 1.25rem; }
  .related-heading { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); font-weight: 500; margin-bottom: 0.125rem; }
  .related-item { display: flex; flex-direction: column; gap: 0.375rem; }
  .related-title { font-size: 0.75rem; font-weight: 500; color: var(--ink-mid); text-transform: uppercase; letter-spacing: 0.07em; }
  .related-bullets { list-style: none; display: flex; flex-direction: column; gap: 0.375rem; }
  .related-bullet { display: flex; align-items: flex-start; gap: 0.625rem; font-size: 0.9375rem; color: var(--ink); line-height: 1.5; font-weight: 300; }
  .related-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--ink-faint); flex-shrink: 0; margin-top: 0.65em; }
  .related-note { font-size: 0.8125rem; color: var(--ink-faint); padding-left: 1rem; font-weight: 300; }

  /* ─── Actions ─── */
  .action-row { display: flex; gap: 8px; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-light); }
  .action-btn {
    background: transparent; border: 1px solid var(--border); border-radius: 100px;
    padding: 0.3rem 1rem; font-family: 'DM Sans', sans-serif;
    font-size: 0.775rem; color: var(--ink-muted); cursor: pointer;
    transition: all 0.18s; font-weight: 400; letter-spacing: 0.02em;
  }
  .action-btn:hover { border-color: var(--ink-mid); color: var(--ink); background: rgba(28,18,8,0.04); }
  .action-btn.saved { border-color: var(--sage); color: var(--sage); }

  /* ─── Loading ─── */
  .loading-row { display: flex; gap: 6px; padding: 0.25rem 0 2rem; align-items: center; }
  .loading-row span { width: 5px; height: 5px; border-radius: 50%; background: var(--ink-faint); opacity: 0.3; animation: dot-pulse 1.4s ease-in-out infinite; }
  .loading-row span:nth-child(2) { animation-delay: 0.18s; }
  .loading-row span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes dot-pulse { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.3)} }

  /* ─── Recent ─── */
  .section-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); font-weight: 500; margin-bottom: 0.625rem; }
  .recent-list { display: flex; flex-direction: column; }
  .recent-btn {
    background: none; border: none; padding: 0.55rem 0;
    font-family: 'DM Sans', sans-serif; font-size: 0.9rem; color: var(--ink-muted);
    cursor: pointer; text-align: left; display: flex; align-items: center; gap: 0.625rem;
    border-bottom: 1px solid var(--border-light); transition: color 0.18s; width: 100%; font-weight: 300;
  }
  .recent-btn:last-child { border-bottom: none; }
  .recent-btn:hover { color: var(--ink); }
  .recent-arrow { color: var(--ink-faint); font-size: 0.7rem; flex-shrink: 0; }

  /* ─── Saved ─── */
  .saved-list { display: flex; flex-direction: column; }
  .saved-item { padding: 1rem 0; border-bottom: 1px solid var(--border-light); }
  .saved-item:last-child { border-bottom: none; }
  .saved-item-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.3rem; }
  .saved-q { font-size: 0.875rem; font-weight: 500; color: var(--ink); line-height: 1.4; }
  .saved-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; margin-top: 0.1rem; }
  .saved-date { font-size: 0.725rem; color: var(--ink-faint); font-weight: 300; }
  .delete-btn { background: none; border: none; cursor: pointer; color: var(--ink-faint); font-size: 0.7rem; padding: 0; transition: color 0.15s; line-height: 1; }
  .delete-btn:hover { color: var(--red); }
  .saved-answer { font-size: 0.875rem; color: var(--ink-muted); line-height: 1.55; font-weight: 300; }

  /* ─── FAQ ─── */
  .faq-section { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border-light); }
  .faq-title { font-family: 'Playfair Display', serif; font-size: 1.125rem; font-weight: 500; color: var(--ink); margin-bottom: 1.25rem; }
  .faq-item { margin-bottom: 1.25rem; }
  .faq-q { font-size: 0.9rem; font-weight: 500; color: var(--ink-mid); margin-bottom: 0.3rem; }
  .faq-a { font-size: 0.875rem; color: var(--ink-muted); line-height: 1.6; font-weight: 300; }

  /* ─── Safety disclaimer ─── */
  .safety-disclaimer {
    margin-top: 1.5rem; padding: 0.875rem 1rem;
    background: var(--amber-bg); border-radius: 6px;
    border: 1px solid rgba(122,92,30,0.15);
    font-size: 0.8rem; color: var(--amber); line-height: 1.55; font-weight: 300;
  }

  .divider { border: none; border-top: 1px solid var(--border-light); margin: 2rem 0 1.5rem; }
  .error-note { font-size: 0.875rem; color: var(--ink-muted); padding: 0.25rem 0; font-style: italic; font-weight: 300; }

  @media (max-width: 480px) {
    .app-body { padding: 0 1.25rem; }
    .header { padding: 1.75rem 1.25rem 1.5rem; }
    .header h1 { font-size: 1.5rem; }
  }
`;

// ─── Timer component ──────────────────────────────────────────────────────────
function Timer({ minutes }) {
  const [secs, setSecs] = useState(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  const start = () => {
    const total = (minutes || 10) * 60;
    setSecs(total);
    setDone(false);
    setRunning(true);
    // Request notification permission when timer starts
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const stop = () => { setRunning(false); clearInterval(intervalRef.current); };
  const reset = () => { stop(); setSecs(null); setDone(false); };

  useEffect(() => {
    if (running && secs !== null) {
      intervalRef.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setDone(true);
            // Fire notification if permitted
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Cook Time Finder", { body: `Your ${minutes}-minute timer is done!` });
            }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  if (secs === null) {
    return (
      <div className="timer-wrap">
        <button className="timer-btn" onClick={start}>
          ⏱ Start {minutes} min timer
        </button>
      </div>
    );
  }

  return (
    <div className="timer-wrap">
      <div className={`timer-display${done ? " done" : ""}`}>
        {done ? "✓ Done!" : formatTime(secs)}
        {!done && (
          <>
            <button className="timer-control" onClick={running ? stop : () => setRunning(true)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button className="timer-control" onClick={reset}>Reset</button>
          </>
        )}
        {done && <button className="timer-control" onClick={reset}>Clear</button>}
      </div>
      {done && <div className="timer-done-msg">Timer complete — check your food!</div>}
    </div>
  );
}

// ─── Table component ──────────────────────────────────────────────────────────
function CompareTable({ table }) {
  if (!table?.headers || !table?.rows?.length) return null;
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead><tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Answer card ──────────────────────────────────────────────────────────────
function AnswerCard({ answer, onSave, onCopy, onAdjust, justSaved, copied }) {
  const timerMinutes = answer.timerMin || null;

  return (
    <div className="answer-block">
      <div className="answer-q">{answer.question}</div>

      {answer.intro && <div className="answer-intro">{answer.intro}</div>}

      {answer.bullets?.length > 0 && (
        <ul className="answer-bullets">
          {answer.bullets.map((b, i) => (
            <li key={i} className="answer-bullet"><span className="bullet-dot" />{b}</li>
          ))}
        </ul>
      )}

      {answer.table && <CompareTable table={answer.table} />}

      {answer.notes?.length > 0 && (
        <ul className="notes-list">
          {answer.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}

      {answer.foodSafety && (
        <div className="food-safety">
          <span className="safety-icon">⚠</span>
          {answer.foodSafety}
        </div>
      )}

      {timerMinutes && <Timer minutes={timerMinutes} />}

      {answer.adjustments?.length > 0 && (
        <div className="adj-section">
          <div className="adj-label">Adjust</div>
          <div className="chips">
            {answer.adjustments.map((adj, i) => (
              <button key={i} className="adj-chip" onClick={() => onAdjust(adj)}>{adj}</button>
            ))}
          </div>
        </div>
      )}

      {answer.followUp && (
        <div className="follow-up-text">{answer.followUp}</div>
      )}

      {answer.related?.length > 0 && (
        <div className="related-section">
          <div className="related-heading">Also useful</div>
          {answer.related.map((rel, ri) => (
            <div key={ri} className="related-item">
              <div className="related-title">{rel.title}</div>
              <ul className="related-bullets">
                {(rel.bullets || []).map((b, bi) => (
                  <li key={bi} className="related-bullet"><span className="related-dot" />{b}</li>
                ))}
              </ul>
              {rel.notes?.filter(Boolean).map((n, ni) => (
                <div key={ni} className="related-note">{n}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="action-row">
        <button className={`action-btn${justSaved ? " saved" : ""}`} onClick={onSave}>
          {justSaved ? "✓ saved" : "save"}
        </button>
        <button className="action-btn" onClick={onCopy}>{copied ? "✓ copied" : "copy"}</button>
      </div>
    </div>
  );
}

// ─── FAQ section ──────────────────────────────────────────────────────────────
function FAQ() {
  const faqs = [
    { q: "What is Cook Time Finder?", a: "Cook Time Finder gives quick cooking times, temperatures, method comparisons, and safe internal temperature guidance — without long recipe articles." },
    { q: "Can I compare oven and air fryer cook times?", a: "Yes. Search for a food like chicken thighs, salmon, potatoes, or frozen fries and Cook Time Finder shows common method options side by side." },
    { q: "Does Cook Time Finder replace a food thermometer?", a: "No. Cook times are estimates. For meat, poultry, fish, and leftovers, always use a food thermometer to confirm the safe internal temperature." },
    { q: "Can I use voice search?", a: "If your browser supports voice input, tap the mic icon to ask cooking questions by voice instead of typing." },
  ];
  return (
    <div className="faq-section">
      <div className="faq-title">Common questions</div>
      {faqs.map((f, i) => (
        <div key={i} className="faq-item">
          <div className="faq-q">{f.q}</div>
          <div className="faq-a">{f.a}</div>
        </div>
      ))}
      <div className="safety-disclaimer">
        Safety guidance is based on common USDA and Health Canada recommendations. Cook times are estimates — always check the thickest part with a food thermometer.
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CookTimeFinder() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setSaved(JSON.parse(localStorage.getItem("ctf-saved") || "[]"));
    setRecent(JSON.parse(localStorage.getItem("ctf-recent") || "[]"));
    setSpeechSupported("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }, []);

  const persist = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const ask = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setAnswer(null); setJustSaved(false);

    const newRecent = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, 8);
    setRecent(newRecent); persist("ctf-recent", newRecent);

    try {
      const seed = resolveSeedAnswer(trimmed);
      if (seed) {
        await new Promise((r) => setTimeout(r, 350));
        setAnswer(seed);
      } else {
        const result = await askClaude(trimmed);
        if (result.offTopic) setError(OFF_TOPIC_MSG);
        else setAnswer({ question: trimmed, ...result });
      }
    } catch {
      const seed = resolveSeedAnswer(trimmed);
      if (seed) setAnswer(seed);
      else setError(NO_AI_MSG);
    } finally {
      setLoading(false);
    }
  }, [recent]);

  const handleSubmit = () => ask(question);
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  // Adjustment chip — append to current query and re-ask
  const handleAdjust = (adj) => {
    const base = answer?.question || question;
    const newQ = `${base} ${adj}`.trim();
    setQuestion(newQ);
    ask(newQ);
  };

  const handleChip = (chip) => { setQuestion(chip); ask(chip); };
  const handleRecent = (q) => { setQuestion(q); ask(q); };

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setQuestion(t); setRecording(false); setListening(false); ask(t);
    };
    rec.onerror = () => { setRecording(false); setListening(false); };
    rec.onend = () => { setRecording(false); setListening(false); };
    rec.start(); setRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false); setListening(false); };

  const handleSave = () => {
    if (!answer) return;
    const summary = answer.bullets?.[0] || answer.intro || "";
    const note = { id: Date.now(), question: answer.question, answer: summary, date: Date.now() };
    const newSaved = [note, ...saved];
    setSaved(newSaved); persist("ctf-saved", newSaved);
    setJustSaved(true); setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDelete = (id) => {
    const ns = saved.filter((s) => s.id !== id);
    setSaved(ns); persist("ctf-saved", ns);
  };

  const handleCopy = () => {
    if (!answer) return;
    const parts = [
      ...(answer.bullets || []).map((b) => `• ${b}`),
      ...(answer.table?.rows || []).map((r) => r.join(" | ")),
      ...(answer.notes || []).map((n) => `  — ${n}`),
      answer.foodSafety ? `⚠ ${answer.foodSafety}` : "",
      answer.followUp ? `→ ${answer.followUp}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const PLACEHOLDERS = [
    "chicken thighs oven vs air fryer",
    "soaked chickpeas Instant Pot",
    "salmon air fryer time",
    "frozen fries air fryer",
    "broccoli oven temp",
    "pork tenderloin internal temp",
  ];
  const placeholder = PLACEHOLDERS[0]; // static for SEO crawlability

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <h1>Cook Times Without the Recipe Blog</h1>
          <p className="header-sub">
            Type or say what you're cooking and get the time, temperature, method options, and safe internal temp instantly.
          </p>
        </div>

        <div className="app-body">
          <div className="input-wrap">
            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="question-input"
                placeholder={placeholder}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
              />
              {speechSupported && (
                <button
                  className={`icon-btn${recording ? " recording" : ""}`}
                  onClick={recording ? stopRecording : startRecording}
                  title={recording ? "Stop recording" : "Ask by voice"}
                >🎤</button>
              )}
              <button className="ask-btn" onClick={handleSubmit} disabled={loading || !question.trim()}>Ask</button>
            </div>
            {listening && <div className="listening-note"><div className="listening-dot" /> Listening…</div>}
            <div className="chips">
              {HERO_CHIPS.map((chip) => (
                <button key={chip} className="chip" onClick={() => handleChip(chip)}>{chip}</button>
              ))}
            </div>
          </div>

          {loading && <div className="loading-row"><span /><span /><span /></div>}
          {error && !loading && <div className="error-note">{error}</div>}

          {answer && !loading && (
            <AnswerCard
              answer={answer}
              onSave={handleSave}
              onCopy={handleCopy}
              onAdjust={handleAdjust}
              justSaved={justSaved}
              copied={copied}
            />
          )}

          {recent.length > 0 && (
            <>
              <hr className="divider" />
              <div className="section-label">Recent</div>
              <div className="recent-list">
                {recent.map((q, i) => (
                  <button key={i} className="recent-btn" onClick={() => handleRecent(q)}>
                    <span className="recent-arrow">↩</span>{q}
                  </button>
                ))}
              </div>
            </>
          )}

          {saved.length > 0 && (
            <>
              <hr className="divider" />
              <div className="section-label">Saved</div>
              <div className="saved-list">
                {saved.map((s) => (
                  <div key={s.id} className="saved-item">
                    <div className="saved-item-header">
                      <div className="saved-q">{s.question}</div>
                      <div className="saved-meta">
                        <span className="saved-date">{formatDate(s.date)}</span>
                        <button className="delete-btn" onClick={() => handleDelete(s.id)} title="Delete">✕</button>
                      </div>
                    </div>
                    <div className="saved-answer">{s.answer}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <FAQ />
        </div>
      </div>
    </>
  );
}
