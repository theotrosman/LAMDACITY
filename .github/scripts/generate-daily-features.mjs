/**
 * LAMDACITY — AI Daily Feature Generator
 *
 * Generates procedural city structures using Groq AI.
 * Each generated feature becomes its own git commit.
 */

import fs from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT = join(__dirname, "..", "..");

const CUSTOM_CELLS_FILE = join(
  ROOT,
  "8bit-city",
  "src",
  "engine",
  "customCells.js"
);

const BRANCH = "master";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing.");
  process.exit(1);
}

const FEATURE_COUNT =
  parseInt(process.env.FEATURE_COUNT) ||
  Math.floor(Math.random() * 8) + 8;

console.log(`🏙 Generating ${FEATURE_COUNT} AI features...`);

// ─────────────────────────────────────────────
// LOAD EXISTING CELLS
// ─────────────────────────────────────────────

function loadExistingCells() {
  try {
    if (!fs.existsSync(CUSTOM_CELLS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(
      CUSTOM_CELLS_FILE,
      "utf8"
    );

    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");

    if (start === -1 || end === -1) {
      return [];
    }

    const json = raw.slice(start, end + 1);

    return JSON.parse(json);
  } catch (err) {
    console.error(
      "❌ Failed loading existing cells:"
    );

    console.error(err);

    return [];
  }
}

// ─────────────────────────────────────────────
// SAVE CELLS
// ─────────────────────────────────────────────

function saveCells(cells) {
  const content = `export const CUSTOM_CELLS = ${JSON.stringify(
    cells,
    null,
    2
  )};
`;

  fs.writeFileSync(
    CUSTOM_CELLS_FILE,
    content,
    "utf8"
  );
}

// ─────────────────────────────────────────────
// CLEAN AI RESPONSE
// ─────────────────────────────────────────────

function cleanJSON(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// ─────────────────────────────────────────────
// GENERATE FEATURES USING GROQ
// ─────────────────────────────────────────────

async function generateAIFeatures(
  count,
  existingIds
) {
  const prompt = `
Generate ${count} UNIQUE structures for a procedural evolving 8-bit city simulator.

IMPORTANT:
- Return ONLY valid JSON array
- No markdown
- No explanations
- No comments
- No duplicate ids

Each object MUST contain:
- id
- label
- emoji
- theme
- palette
- effect
- trigger

Style:
- magical
- futuristic
- surreal
- retro game
- simulation game
- pixel-art inspired

Existing ids to avoid:
${existingIds.join(", ")}

Example:
[
  {
    "id": "gravity_market",
    "label": "Gravity Market",
    "emoji": "🛸",
    "theme": "floating anti-gravity bazaar with neon fruits and suspended roads",
    "palette": "#0a0a1a,#ff40ff,#40ffff",
    "effect": "economy+12,happiness+8",
    "trigger": "magia"
  }
]
`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 1.3,
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content:
                "You generate procedural simulation-game content.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    console.log("🧠 RAW AI RESPONSE:");
    console.log(
      JSON.stringify(data, null, 2)
    );

    const content =
      data?.choices?.[0]?.message?.content || "[]";

    console.log("🧠 AI CONTENT:");
    console.log(content);

    const cleaned = cleanJSON(content);

    console.log("🧼 CLEANED JSON:");
    console.log(cleaned);

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error(
        "AI response is not an array."
      );
    }

    return parsed;
  } catch (err) {
    console.error(
      "❌ Failed generating AI features:"
    );

    console.error(err);

    return [];
  }
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  const existing = loadExistingCells();

  console.log(
    `📦 Existing cells: ${existing.length}`
  );

  const existingIds = existing.map(
    (c) => c.id
  );

  const generated = await generateAIFeatures(
    FEATURE_COUNT,
    existingIds
  );

  console.log(
    `✨ AI generated ${generated.length} features`
  );

  if (!generated.length) {
    console.log(
      "⚠ No features generated."
    );

    return;
  }

  for (const feature of generated) {
    try {
      if (!feature.id) {
        console.log(
          "⚠ Invalid feature skipped"
        );

        continue;
      }

      const duplicate = existing.find(
        (c) => c.id === feature.id
      );

      if (duplicate) {
        console.log(
          `⚠ Duplicate skipped: ${feature.id}`
        );

        continue;
      }

      const cell = {
        ...feature,
        rarity: "daily",
        generatedAt:
          new Date().toISOString(),
      };

      existing.push(cell);

      saveCells(existing);

      console.log(
        `✅ Added feature: ${feature.label}`
      );

      // ───────────────────────────
      // VERIFY FILE CHANGED
      // ───────────────────────────

      const diff = execSync(
        "git status --porcelain",
        {
          encoding: "utf8",
        }
      );

      console.log(
        "🧪 GIT STATUS:"
      );

      console.log(diff);

      if (!diff.trim()) {
        console.log(
          "⚠ No git changes detected"
        );

        continue;
      }

      // ───────────────────────────
      // GIT COMMIT
      // ───────────────────────────

      execSync("git add .", {
        stdio: "inherit",
      });

      execSync(
        `git commit -m "feat(ai): add ${feature.id}"`,
        {
          stdio: "inherit",
        }
      );

      console.log(
        `🚀 Pushing ${feature.id}...`
      );

      execSync(
        `git push origin HEAD:${BRANCH}`,
        {
          stdio: "inherit",
        }
      );

      console.log(
        `✅ Successfully pushed ${feature.id}`
      );
    } catch (err) {
      console.error(
        `❌ Failed processing ${feature.id}`
      );

      console.error(err);
    }
  }

  console.log(
    "🏙 Daily AI evolution complete."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});