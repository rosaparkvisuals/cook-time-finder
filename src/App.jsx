import { useState, useEffect, useRef, useCallback } from "react";

// ─── Method detection ────────────────────────────────────────────────────────
const METHOD_PATTERNS = {
  oven:       /\b(oven|baked?|roasted?)\b/i,
  airfryer:   /\b(air\s*fry(er)?|airfryer)\b/i,
  instantpot: /\b(instant\s*pot|pressure\s*cooker|ip)\b/i,
  stovetop:   /\b(stovetop|pan|skillet|stove)\b/i,
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
    .replace(/cook\s*time|cooking\s*time|cooktime|how\s*long|how\s+do\s+i\s+cook/gi, "")
    .replace(/\s+/g, " ").trim();
}

// ─── Seed DB ─────────────────────────────────────────────────────────────────
const SEED_DB = [
  {
    id: "chicken-thigh",
    keywords: ["chicken thigh", "chicken thighs"],
    relatedIds: ["chicken-breast"],
    methods: {
      oven: {
        bullets: ["Boneless thighs: 425°F for 20–25 min", "Bone-in thighs: 425°F for 35–45 min"],
        notes: ["Rest 5 min before serving"],
        foodSafety: "Cook to 165°F minimum. Thighs are best at 175–185°F for tender texture.",
      },
      airfryer: {
        bullets: ["Boneless thighs: 380–400°F for 12–16 min", "Bone-in thighs: 380–400°F for 20–28 min"],
        notes: ["Flip halfway through", "Start checking early for small thighs"],
        foodSafety: "Cook to 165°F minimum.",
      },
      instantpot: {
        bullets: ["Boneless thighs: High Pressure for 8–10 min", "Bone-in thighs: High Pressure for 10–12 min", "Natural release for 5 min"],
        notes: ["Add ½ cup liquid minimum"],
        foodSafety: "Cook to 165°F minimum.",
      },
      stovetop: {
        bullets: ["Boneless: medium-high, 6–8 min per side", "Bone-in: medium, 10–12 min per side with lid on"],
        foodSafety: "Cook to 165°F minimum.",
      },
      grill: {
        bullets: ["Boneless: medium-high, 6–7 min per side", "Bone-in: indirect heat 30–40 min, then sear"],
        notes: ["Rest 5 min before serving"],
        foodSafety: "Cook to 165°F minimum.",
      },
    },
    ambiguous: {
      intro: "Chicken thighs cook differently depending on method and cut.",
      table: {
        headers: ["Method", "Boneless", "Bone-in", "Temp"],
        rows: [
          ["Oven",        "20–25 min",    "35–45 min",    "425°F"],
          ["Air fryer",   "12–16 min",    "20–28 min",    "380–400°F"],
          ["Instant Pot", "8–10 min",     "10–12 min",    "High Pressure"],
          ["Stovetop",    "6–8 min/side", "10–12 min/side","Med-high"],
          ["Grill",       "6–7 min/side", "30–40 min",    "Med-high"],
        ],
      },
      foodSafety: "Cook to 165°F minimum. Thighs are best at 175–185°F for tender texture.",
      followUp: "Which method are you using?",
    },
  },
  {
    id: "chicken-breast",
    keywords: ["chicken breast", "chicken breasts"],
    relatedIds: ["chicken-thigh"],
    methods: {
      oven: {
        bullets: ["Boneless: 425°F for 18–22 min", "Bone-in: 400°F for 35–45 min"],
        notes: ["Rest 5 min before slicing"],
        foodSafety: "Cook to 165°F internal temperature.",
      },
      airfryer: {
        bullets: ["375°F for 14–18 min (boneless)", "Flip halfway through"],
        notes: ["Pound to even thickness for uniform cooking"],
        foodSafety: "Cook to 165°F internal temperature.",
      },
      stovetop: {
        bullets: ["Medium-high, 6–7 min per side (boneless)", "Cover for last 2 min to cook through"],
        notes: ["Rest 5 min before slicing"],
        foodSafety: "Cook to 165°F internal temperature.",
      },
    },
    ambiguous: {
      intro: "Chicken breast timing depends on method and cut.",
      table: {
        headers: ["Method", "Boneless", "Bone-in", "Temp"],
        rows: [
          ["Oven",       "18–22 min",    "35–45 min", "400–425°F"],
          ["Air fryer",  "14–18 min",    "—",         "375°F"],
          ["Stovetop",   "6–7 min/side", "—",         "Med-high"],
        ],
      },
      foodSafety: "Cook to 165°F internal temperature.",
      followUp: "Are you using the oven, air fryer, or stovetop?",
    },
  },
  {
    id: "salmon",
    keywords: ["salmon"],
    relatedIds: [],
    methods: {
      oven: {
        bullets: ["400°F for 12–15 min per inch of thickness", "Done when flesh flakes easily with a fork"],
        foodSafety: "FDA recommends 145°F. Many prefer 125–130°F for moist texture.",
      },
      airfryer: {
        bullets: ["375°F for 8–10 min", "No need to flip"],
        notes: ["Check at 8 min — goes from done to overdone fast"],
        foodSafety: "FDA recommends 145°F internal temp.",
      },
      stovetop: {
        bullets: ["Medium-high, skin-side down 4–5 min", "Flip and cook 2–3 min more"],
        notes: ["Press down gently at start for crispy skin"],
        foodSafety: "FDA recommends 145°F internal temp.",
      },
      grill: {
        bullets: ["Medium-high, 3–4 min per side", "Oil the grate well to prevent sticking"],
        foodSafety: "FDA recommends 145°F internal temp.",
      },
    },
    ambiguous: {
      intro: "Salmon cooks quickly — method matters most.",
      table: {
        headers: ["Method", "Time", "Temp"],
        rows: [
          ["Oven",      "12–15 min/inch", "400°F"],
          ["Air fryer", "8–10 min",       "375°F"],
          ["Stovetop",  "4–5 min/side",   "Med-high"],
          ["Grill",     "3–4 min/side",   "Med-high"],
        ],
      },
      foodSafety: "FDA recommends 145°F. Many prefer 125–130°F for moist texture.",
      followUp: "How are you cooking it?",
    },
  },
  {
    id: "potato",
    keywords: ["potato", "potatoes"],
    relatedIds: ["sweet-potato"],
    methods: {
      oven: {
        bullets: ["Whole: 400°F for 45–60 min", "Cubed/wedges: 425°F for 25–35 min", "Flip cubes halfway"],
        notes: ["Pierce whole potatoes before baking"],
      },
      airfryer: {
        bullets: ["Cubed: 400°F for 15–20 min, shake halfway", "Whole: 400°F for 35–40 min"],
        notes: ["Single layer only for cubes"],
      },
      stovetop: {
        bullets: ["Boiling whole: 20–30 min in salted water", "Cubed: 10–15 min", "Start in cold water for even cooking"],
      },
      instantpot: {
        bullets: ["Whole: High Pressure 12–15 min + quick release", "Cubed: 5–7 min + quick release"],
        notes: ["Use 1 cup water in pot"],
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
      followUp: "Are you baking, boiling, or using another method?",
    },
  },
  {
    id: "sweet-potato",
    keywords: ["sweet potato", "sweet potatoes"],
    relatedIds: ["potato"],
    methods: {
      oven: {
        bullets: ["Whole: 425°F for 45–60 min", "Cubed: 425°F for 20–25 min", "Halved: 425°F for 30–40 min"],
        notes: ["Done when easily pierced with a fork", "Flip cubes halfway"],
      },
      airfryer: {
        bullets: ["Cubed: 375–400°F for 12–15 min", "Shake halfway"],
        notes: ["Single layer only"],
      },
      microwave: {
        bullets: ["Pierce skin, microwave on High for 5–8 min", "Flip halfway, check at 5 min"],
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
      followUp: "How are you cooking them?",
    },
  },
  {
    id: "soaked-chickpea",
    keywords: ["soaked chickpea", "soaked chick pea"],
    relatedIds: ["unsoaked-chickpea"],
    bullets: ["High Pressure for 8–12 min", "Natural release for 10 min", "Use 3 cups water per 1 cup chickpeas"],
    notes: ["Natural release gives better texture"],
  },
  {
    id: "unsoaked-chickpea",
    keywords: ["unsoaked chickpea", "chickpea", "chick pea"],
    relatedIds: ["soaked-chickpea"],
    bullets: ["High Pressure for 35–40 min", "Natural release for 15 min"],
    notes: ["Soaking first cuts cook time by ~75%"],
  },
  {
    id: "white-rice",
    keywords: ["white rice", "rice ratio", "rice water", "rice stovetop"],
    relatedIds: ["rice-serving", "brown-rice"],
    bullets: ["1 cup rice to 1¼ cups water", "Simmer covered for 15 min", "Rest off heat for 10 min — don't lift lid"],
    notes: ["Rinse until water runs clear for fluffier results"],
  },
  {
    id: "brown-rice",
    keywords: ["brown rice"],
    relatedIds: ["white-rice", "rice-serving"],
    bullets: ["1 cup brown rice to 2 cups water", "Simmer covered for 45 min", "Rest off heat for 10 min"],
    notes: ["Brown rice takes ~3× longer than white rice"],
  },
  {
    id: "boiled-egg",
    keywords: ["hard boiled egg", "hard-boiled egg", "boiled egg"],
    relatedIds: ["soft-boiled-egg"],
    bullets: ["Simmer for 10–12 min", "Ice water immediately after for 5 min", "10 min = jammy · 12 min = fully set"],
    notes: ["Ice bath stops cooking and makes peeling easier"],
  },
  {
    id: "soft-boiled-egg",
    keywords: ["soft boiled egg", "soft-boiled egg", "jammy egg", "runny egg"],
    relatedIds: ["boiled-egg"],
    bullets: ["Simmer for 6–7 min", "Ice water immediately after for 5 min", "6 min = runny · 7 min = jammy"],
    notes: ["Perfect for ramen, salads, or toast"],
  },
  {
    id: "buttermilk-sub",
    keywords: ["buttermilk substitute", "buttermilk replacement", "no buttermilk"],
    relatedIds: [],
    bullets: ["1 cup milk + 1 tbsp lemon juice or white vinegar", "Stir, sit 5–10 min until slightly curdled", "Use 1:1 in any baking recipe"],
    notes: ["Whole milk gives best results"],
  },
  {
    id: "air-fryer-fries",
    keywords: ["frozen fries", "air fry fries"],
    relatedIds: [],
    bullets: ["400°F for 12–18 min", "Shake basket halfway", "Single layer only — don't overcrowd"],
    notes: ["Thin fries ~12 min · thick steak fries ~18 min"],
  },
  {
    id: "pasta-salt",
    keywords: ["pasta water", "pasta salt", "salt pasta"],
    relatedIds: [],
    bullets: ["1 tbsp salt per gallon of water", "Water should taste like mild seawater"],
    notes: ["Under-salting is the most common pasta mistake"],
  },
  {
    id: "rice-serving",
    keywords: ["how much rice", "rice per person", "rice serving"],
    relatedIds: ["white-rice", "brown-rice"],
    bullets: ["Side dish: ½ cup dry rice per person", "Main: 1 cup dry rice per person", "Dry rice doubles in volume when cooked"],
    notes: [],
  },
];

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
      return { question, ...entry.methods[method], related: findRelatedFromSeed(entry) };
    }
    if (method && !entry.methods[method]) {
      // Method specified but not in seed — let Claude handle it
      return null;
    }
    if (entry.ambiguous) {
      return { question, ...entry.ambiguous, related: findRelatedFromSeed(entry) };
    }
  }
  // No methods object: if a method is specified that we can't answer, defer to Claude
  if (method) return null;
  return { question, ...entry, related: findRelatedFromSeed(entry) };
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a concise cooking-time and temperature reference assistant. Answer cooking questions with quick, practical facts. Do not write recipe blog content, stories, intros, SEO text, or background.

If the user asks a vague cooking-time question and the food is clear but the appliance or method is missing: first provide the most common cooking methods in a compact comparison table, then ask ONE short follow-up. If the method is included in the query, answer only for that method.

Always include time, temperature, and internal temperature when relevant. For meat, poultry, seafood, and eggs, include a food safety note. Keep answers short and practical.

For ambiguous method queries:
1. One short intro sentence (field: "intro")
2. Comparison table (field: "table" with "headers" and "rows")
3. Food safety if relevant (field: "foodSafety")
4. One short follow-up (field: "followUp")

For specific method queries:
1. Direct bullets — 2–4 short facts (field: "bullets")
2. Notes — max 2 bullets (field: "notes")
3. Food safety if relevant (field: "foodSafety")

Format your response EXACTLY as this JSON (no markdown, no extra text):
{
  "intro": "One sentence if ambiguous, otherwise omit",
  "bullets": ["fact 1", "fact 2"],
  "table": { "headers": ["Method","Time","Temp"], "rows": [["Oven","20–25 min","425°F"]] },
  "notes": ["tip"],
  "foodSafety": "only if relevant",
  "followUp": "Short question if ambiguous",
  "related": [{ "title": "Related topic", "bullets": ["fact"], "notes": [] }]
}

Use "table" for multi-method comparisons; use "bullets" for single-method answers. Never use both.

If the question is not about cooking, food, or kitchen topics, respond with:
{"offTopic": true}`;

async function askClaude(question) {
  const response = await fetch("api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!response.ok) throw new Error("API error");
  const data = await response.json();
console.log("Full response:", JSON.stringify(data));
const text = data?.content?.[0]?.text || data?.content?.find?.((b) => b.type === "text")?.text || "";
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch { return { bullets: [text], notes: [] }; }
}

const OFF_TOPIC_MSG = "Do you have a cooking question I can help with?";
const NO_AI_MSG = "Do you have a cooking question I can help with?";

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

const CHIPS = ["🫕 Instant Pot", "🌡️ Oven temp", "💨 Air fryer", "🍚 Rice", "🫘 Beans", "🔄 Substitutions", "🛡️ Food safety"];

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
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .app {
    min-height: 100vh;
    max-width: 580px;
    margin: 0 auto;
    padding: 0 0 6rem;
  }

  /* ─── Header ─── */
  .header {
    padding: 2.25rem 1.75rem 2rem;
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 2.5rem;
  }

  .appliance-icons {
    display: flex;
    gap: 0.625rem;
    margin-bottom: 1.125rem;
  }

  .appliance-icons span {
    font-size: 1.25rem;
    opacity: 0.55;
    cursor: default;
    transition: opacity 0.2s, transform 0.2s;
    display: inline-block;
  }

  .appliance-icons span:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .header-inner { margin-bottom: 0.25rem; }

  .header h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }

  .header p {
    font-size: 0.8125rem;
    color: var(--ink-faint);
    font-weight: 300;
    letter-spacing: 0.01em;
  }

  .app-body { padding: 0 1.75rem; }

  /* ─── Input ─── */
  .input-wrap { margin-bottom: 2.5rem; }

  .input-row { display: flex; gap: 8px; align-items: flex-end; }

  .question-input {
    flex: 1;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9375rem;
    font-weight: 300;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.8125rem 1rem;
    resize: none;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    line-height: 1.5;
    min-height: 50px;
    max-height: 120px;
  }

  .question-input::placeholder {
    color: var(--ink-faint);
    font-weight: 300;
  }

  .question-input:focus {
    border-color: var(--ink-mid);
    box-shadow: 0 0 0 3px rgba(28,18,8,0.06);
  }

  .icon-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 42px; height: 42px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    font-size: 0.9375rem;
    color: var(--ink-muted);
  }

  .icon-btn:hover { border-color: var(--ink-mid); color: var(--ink); }
  .icon-btn.recording {
    background: var(--accent); border-color: var(--accent); color: white;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(184,64,22,0.3); }
    50% { box-shadow: 0 0 0 7px rgba(184,64,22,0); }
  }

  .ask-btn {
    background: var(--ink);
    color: #F7F2EB;
    border: none;
    border-radius: 8px;
    padding: 0 1.25rem;
    height: 42px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .ask-btn:hover { background: var(--ink-mid); }
  .ask-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  .listening-note {
    font-size: 0.78rem; color: var(--accent);
    margin-top: 0.5rem; display: flex; align-items: center; gap: 5px;
    font-weight: 400; letter-spacing: 0.02em;
  }
  .listening-dot {
    width: 5px; height: 5px; background: var(--accent);
    border-radius: 50%; animation: blink 1s infinite; flex-shrink: 0;
  }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 1rem;
  }

  .chip {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 0.2rem 0.75rem;
    font-size: 0.775rem;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.18s;
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .chip:hover {
    border-color: var(--ink-mid);
    color: var(--ink);
    background: rgba(28,18,8,0.04);
  }

  /* ─── Answer block ─── */
  .answer-block { margin-bottom: 2.5rem; }

  .answer-q {
    font-size: 0.725rem;
    color: var(--ink-faint);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }

  .answer-intro {
    font-size: 0.9375rem;
    color: var(--ink-muted);
    line-height: 1.65;
    margin-bottom: 1.25rem;
    font-weight: 300;
    font-style: italic;
  }

  .answer-bullets {
    list-style: none;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .answer-bullet {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 1rem;
    line-height: 1.55;
    color: var(--ink);
    font-weight: 400;
  }

  .bullet-dot {
    width: 4px; height: 4px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    margin-top: 0.6em;
  }

  /* ─── Table ─── */
  .compare-table-wrap {
    overflow-x: auto;
    margin-bottom: 1.5rem;
    border-radius: 6px;
    border: 1px solid var(--border-light);
  }

  .compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    font-family: 'DM Sans', sans-serif;
  }

  .compare-table th {
    text-align: left;
    padding: 0.625rem 0.875rem;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    font-weight: 500;
    color: var(--ink-faint);
    background: rgba(28,18,8,0.025);
    border-bottom: 1px solid var(--border-light);
  }

  .compare-table td {
    padding: 0.65rem 0.875rem;
    color: var(--ink);
    border-bottom: 1px solid var(--border-light);
    line-height: 1.4;
  }

  .compare-table tr:last-child td { border-bottom: none; }
  .compare-table td:first-child {
    font-weight: 500;
    color: var(--ink-mid);
    white-space: nowrap;
  }

  /* ─── Notes ─── */
  .notes-list {
    list-style: none;
    margin-bottom: 1.25rem;
    border-top: 1px solid var(--border-light);
    padding-top: 1rem;
  }

  .notes-list li {
    font-size: 0.875rem;
    color: var(--ink-muted);
    line-height: 1.6;
    padding: 0.175rem 0 0.175rem 1rem;
    position: relative;
    font-weight: 300;
  }

  .notes-list li::before {
    content: "—";
    position: absolute;
    left: 0;
    color: var(--ink-faint);
    font-size: 0.75rem;
    top: 0.3em;
  }

  /* ─── Food safety ─── */
  .food-safety {
    font-size: 0.8125rem;
    color: var(--red);
    line-height: 1.6;
    margin-bottom: 1.25rem;
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 0.75rem 0.875rem;
    background: var(--red-bg);
    border-radius: 6px;
    font-weight: 300;
  }

  .safety-icon { flex-shrink: 0; font-size: 0.75rem; margin-top: 0.15em; }

  /* ─── Follow-up ─── */
  .follow-up-text {
    font-size: 0.875rem;
    color: var(--ink-muted);
    margin-bottom: 1.25rem;
    font-style: italic;
    font-weight: 300;
    padding-left: 0.875rem;
    border-left: 2px solid var(--border);
  }

  /* ─── Related ─── */
  .related-section {
    margin-top: 2rem;
    padding-top: 1.75rem;
    border-top: 1px solid var(--border-light);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .related-heading {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
    font-weight: 500;
    margin-bottom: 0;
  }

  .related-item { display: flex; flex-direction: column; gap: 0.4rem; }

  .related-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ink-mid);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .related-bullets { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }

  .related-bullet {
    display: flex; align-items: flex-start; gap: 0.625rem;
    font-size: 0.9375rem; color: var(--ink); line-height: 1.5;
    font-weight: 300;
  }

  .related-dot {
    width: 3px; height: 3px;
    border-radius: 50%; background: var(--ink-faint);
    flex-shrink: 0; margin-top: 0.65em;
  }

  .related-note {
    font-size: 0.8125rem; color: var(--ink-faint);
    padding-left: 1rem; font-weight: 300;
  }

  /* ─── Actions ─── */
  .action-row {
    display: flex;
    gap: 8px;
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-light);
  }

  .action-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 0.3rem 1rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.775rem;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.18s;
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  .action-btn:hover { border-color: var(--ink-mid); color: var(--ink); background: rgba(28,18,8,0.04); }
  .action-btn.saved { border-color: var(--sage); color: var(--sage); }

  /* ─── Loading ─── */
  .loading-row {
    display: flex;
    gap: 6px;
    padding: 0.25rem 0 2rem;
    align-items: center;
  }

  .loading-row span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--ink-faint);
    opacity: 0.3;
    animation: dot-pulse 1.4s ease-in-out infinite;
  }

  .loading-row span:nth-child(2) { animation-delay: 0.18s; }
  .loading-row span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes dot-pulse { 0%,100%{opacity:0.2;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.3)} }

  /* ─── Recent ─── */
  .section-label {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-faint);
    font-weight: 500;
    margin-bottom: 0.75rem;
  }

  .recent-list { display: flex; flex-direction: column; }

  .recent-btn {
    background: none; border: none;
    padding: 0.6rem 0;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    color: var(--ink-muted);
    cursor: pointer;
    text-align: left;
    display: flex; align-items: center; gap: 0.625rem;
    border-bottom: 1px solid var(--border-light);
    transition: color 0.18s;
    width: 100%;
    font-weight: 300;
  }

  .recent-btn:last-child { border-bottom: none; }
  .recent-btn:hover { color: var(--ink); }
  .recent-arrow { color: var(--ink-faint); font-size: 0.7rem; flex-shrink: 0; }

  /* ─── Saved ─── */
  .saved-list { display: flex; flex-direction: column; }

  .saved-item {
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-light);
  }

  .saved-item:last-child { border-bottom: none; }

  .saved-item-header {
    display: flex; justify-content: space-between;
    align-items: flex-start; gap: 0.75rem; margin-bottom: 0.3rem;
  }

  .saved-q { font-size: 0.875rem; font-weight: 500; color: var(--ink); line-height: 1.4; }

  .saved-meta { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; margin-top: 0.1rem; }
  .saved-date { font-size: 0.725rem; color: var(--ink-faint); font-weight: 300; }

  .delete-btn {
    background: none; border: none; cursor: pointer;
    color: var(--ink-faint); font-size: 0.7rem; padding: 0;
    transition: color 0.15s; line-height: 1;
  }

  .delete-btn:hover { color: var(--red); }
  .saved-answer { font-size: 0.875rem; color: var(--ink-muted); line-height: 1.55; font-weight: 300; }

  .divider { border: none; border-top: 1px solid var(--border-light); margin: 2rem 0 1.5rem; }

  .error-note {
    font-size: 0.875rem; color: var(--ink-muted);
    padding: 0.25rem 0; font-style: italic; font-weight: 300;
  }

  @media (max-width: 480px) {
    .app-body { padding: 0 1.25rem; }
    .header { padding: 1.75rem 1.25rem 1.5rem; }
    .header h1 { font-size: 1.5rem; }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────
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

function AnswerCard({ answer, onSave, onCopy, justSaved, copied }) {
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

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    setSaved(JSON.parse(localStorage.getItem("qkn-saved") || "[]"));
    setRecent(JSON.parse(localStorage.getItem("qkn-recent") || "[]"));
    setSpeechSupported("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }, []);

  const persist = (key, val) => localStorage.setItem(key, JSON.stringify(val));

  const ask = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true); setError(null); setAnswer(null); setJustSaved(false);
    const newRecent = [trimmed, ...recent.filter((r) => r !== trimmed)].slice(0, 5);
    setRecent(newRecent); persist("qkn-recent", newRecent);
    try {
      const seed = resolveSeedAnswer(trimmed);
      if (seed) { await new Promise((r) => setTimeout(r, 450)); setAnswer(seed); }
      else {
        const result = await askClaude(trimmed);
        if (result.offTopic) { setError(OFF_TOPIC_MSG); }
        else { setAnswer({ question: trimmed, ...result }); }
      }
    } catch {
      const seed = resolveSeedAnswer(trimmed);
      if (seed) setAnswer(seed);
      else setError(NO_AI_MSG);
    } finally { setLoading(false); }
  }, [recent]);

  const handleSubmit = () => ask(question);
  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } };

  const CHIP_MAP = {
    "🫕 Instant Pot": "How long to cook chickpeas in the Instant Pot?",
    "🌡️ Oven temp": "chicken thigh oven cooktime",
    "💨 Air fryer": "chicken thigh air fryer",
    "🍚 Rice": "rice ratio stovetop",
    "🫘 Beans": "How long to cook dried beans stovetop?",
    "🔄 Substitutions": "Substitute for buttermilk?",
    "🛡️ Food safety": "What internal temperature does chicken need to reach?",
  };

  const handleChip = (chip) => { const q = CHIP_MAP[chip] || chip; setQuestion(q); ask(q); };
  const handleRecent = (q) => { setQuestion(q); ask(q); };

  const startRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US"; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setQuestion(t); setRecording(false); setListening(false); ask(t); };
    rec.onerror = () => { setRecording(false); setListening(false); };
    rec.onend = () => { setRecording(false); setListening(false); };
    rec.start(); setRecording(true);
  };

  const stopRecording = () => { recognitionRef.current?.stop(); setRecording(false); setListening(false); };

  const handleSave = () => {
    if (!answer) return;
    const summary = answer.bullets?.[0] || answer.intro || "";
    const note = { id: Date.now(), question: answer.question, answer: summary, date: Date.now() };
    const newSaved = [note, ...saved]; setSaved(newSaved); persist("qkn-saved", newSaved);
    setJustSaved(true); setTimeout(() => setJustSaved(false), 2000);
  };

  const handleDelete = (id) => { const ns = saved.filter((s) => s.id !== id); setSaved(ns); persist("qkn-saved", ns); };

  const handleCopy = () => {
    if (!answer) return;
    const parts = [
      ...(answer.bullets || []).map((b) => `• ${b}`),
      ...(answer.table?.rows || []).map((r) => r.join(" | ")),
      ...(answer.notes || []).map((n) => `  – ${n}`),
      answer.foodSafety ? `⚠ ${answer.foodSafety}` : "",
      answer.followUp ? `→ ${answer.followUp}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n"));
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <div className="header-inner">
            <h1>Cook Time Finder</h1>
          </div>
          <p>Fast answers while you cook.</p>
        </div>
        <div className="app-body">
          <div className="input-wrap">
            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="question-input"
                placeholder="Ask a quick cooking question…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKey}
                rows={2}
              />
              {speechSupported && (
                <button
                  className={`icon-btn${recording ? " recording" : ""}`}
                  onClick={recording ? stopRecording : startRecording}
                  title={recording ? "Stop" : "Voice input"}
                >🎤</button>
              )}
              <button className="ask-btn" onClick={handleSubmit} disabled={loading || !question.trim()}>Ask</button>
            </div>
            {listening && <div className="listening-note"><div className="listening-dot" /> Listening…</div>}
            <div className="chips">
              {CHIPS.map((chip) => <button key={chip} className="chip" onClick={() => handleChip(chip)}>{chip}</button>)}
            </div>
          </div>

          {loading && <div className="loading-row"><span /><span /><span /></div>}
          {error && !loading && <div className="error-note">{error}</div>}
          {answer && !loading && (
            <AnswerCard answer={answer} onSave={handleSave} onCopy={handleCopy} justSaved={justSaved} copied={copied} />
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
        </div>
      </div>
    </>
  );
}
