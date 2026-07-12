// scripts/health-check.mjs
// Contrôle qualité du site + auto-réparation légère + rapport détaillé
// Se lance après les scripts de génération de contenu, dans un workflow séparé.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const NOW = new Date();
const results = []; // { check, status: 'ok'|'warn'|'fail', detail, repaired }

function log(check, status, detail, repaired = false) {
  results.push({ check, status, detail, repaired });
}

// ---------- Utilitaires ----------
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return undefined; // JSON invalide (distinct de "fichier absent")
  }
}

function ageInHours(timestamp) {
  if (!timestamp) return null;
  const ageMs = NOW.getTime() - timestamp;
  return Math.round(ageMs / 36e5 * 10) / 10;
}

// ---------- 1. Validation des fichiers de données ----------
const DATA_FILES = [
  { path: "data/news-ai.json", regenScript: "scripts/update-content.mjs", maxAgeH: 8, minItems: 1 },
  { path: "data/trends-ai.json", regenScript: "scripts/update-content.mjs", maxAgeH: 8, minItems: 1 },
  { path: "data/videos.json", regenScript: "scripts/fetch_data.py", maxAgeH: 8, minItems: 1, runner: "python" },
  { path: "data/films-releases.json", regenScript: "scripts/update-releases.mjs", maxAgeH: 8, minItems: 1 },
  { path: "data/series-releases.json", regenScript: "scripts/update-releases.mjs", maxAgeH: 8, minItems: 1 },
];

const alreadyRegenerated = new Set();

for (const file of DATA_FILES) {
  const data = readJson(file.path);

  if (data === null) {
    log(file.path, "fail", "Fichier absent.");
    tryRegenerate(file);
    continue;
  }
  if (data === undefined) {
    log(file.path, "fail", "JSON invalide / corrompu.");
    tryRegenerate(file);
    continue;
  }
  if (!Array.isArray(data.items)) {
    log(file.path, "fail", "Structure inattendue : pas de tableau 'items'.");
    tryRegenerate(file);
    continue;
  }
  if (data.items.length < file.minItems) {
    log(file.path, "warn", `Seulement ${data.items.length} élément(s), en dessous du minimum attendu (${file.minItems}).`);
    tryRegenerate(file);
    continue;
  }

  const age = ageInHours(data.updatedAt);
  if (age !== null && age > file.maxAgeH) {
    log(file.path, "warn", `Donnée périmée : dernière mise à jour il y a ${age}h (seuil : ${file.maxAgeH}h).`);
  } else {
    log(file.path, "ok", `${data.items.length} élément(s)${age !== null ? `, mis à jour il y a ${age}h` : ""}.`);
  }

  // Contrôle champs essentiels sur un échantillon
  const missingTitle = data.items.filter(i => !i.title).length;
  const missingLink = data.items.filter(i => !i.link).length;
  if (missingTitle > 0) log(`${file.path} (champs)`, "warn", `${missingTitle} élément(s) sans titre.`);
  if (missingLink > 0) log(`${file.path} (champs)`, "warn", `${missingLink} élément(s) sans lien.`);
}

function tryRegenerate(file) {
  if (alreadyRegenerated.has(file.regenScript)) return; // évite de relancer 2x le même script
  alreadyRegenerated.add(file.regenScript);
  try {
    const cmd = file.runner === "python" ? `python3 ${file.regenScript}` : `node ${file.regenScript}`;
    execSync(cmd, { stdio: "inherit", env: process.env });
    log(file.regenScript, "ok", "Auto-réparation : script relancé avec succès.", true);
  } catch (e) {
    log(file.regenScript, "fail", `Auto-réparation échouée : ${e.message}`.slice(0, 300));
  }
}

// ---------- 2. Vérification des flux radio ----------
const RADIOS = [
  { name: "France Info", url: "https://icecast.radiofrance.fr/franceinfo-midfi.mp3" },
  { name: "France Culture", url: "https://icecast.radiofrance.fr/franceculture-midfi.mp3" },
  { name: "France Musique", url: "https://icecast.radiofrance.fr/francemusique-midfi.mp3" },
  { name: "FIP", url: "https://icecast.radiofrance.fr/fip-midfi.mp3" },
];

for (const radio of RADIOS) {
  try {
    const res = await fetch(radio.url, { method: "HEAD", signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      log(`Radio · ${radio.name}`, "ok", `Flux joignable (HTTP ${res.status}).`);
    } else {
      log(`Radio · ${radio.name}`, "warn", `Réponse HTTP ${res.status} — à vérifier manuellement.`);
    }
  } catch (e) {
    log(`Radio · ${radio.name}`, "warn", `Injoignable depuis le serveur d'Actions (${e.message}). Peut fonctionner normalement depuis un navigateur.`);
  }
}

// ---------- 3. Cohérence des pages HTML ----------
const PAGES = ["index.html", "films.html", "series.html"];
for (const page of PAGES) {
  if (!existsSync(page)) {
    log(page, "fail", "Page manquante à la racine du repo.");
  } else {
    log(page, "ok", "Présente.");
  }
}

// ---------- 4. Résumé ----------
const fails = results.filter(r => r.status === "fail").length;
const warns = results.filter(r => r.status === "warn").length;
const repaired = results.filter(r => r.repaired).length;
const globalStatus = fails > 0 ? "🔴 ATTENTION REQUISE" : warns > 0 ? "🟠 SURVEILLANCE" : "🟢 SAIN";

const report = {
  generatedAt: NOW.toISOString(),
  globalStatus,
  summary: { ok: results.filter(r => r.status === "ok").length, warn: warns, fail: fails, repaired },
  checks: results,
};

writeFileSync("data/health-report.json", JSON.stringify(report, null, 2));

// ---------- 5. Rapport lisible (à coller à Claude) ----------
const md = [
  `# Rapport de santé — Programme TV`,
  ``,
  `**Statut global : ${globalStatus}**`,
  `Généré le ${NOW.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`,
  ``,
  `${report.summary.ok} OK · ${report.summary.warn} avertissement(s) · ${report.summary.fail} échec(s) · ${report.summary.repaired} auto-réparation(s)`,
  ``,
  `## Détail`,
  ``,
  ...results.map(r => {
    const icon = r.status === "ok" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
    const repairTag = r.repaired ? " *(auto-réparé)*" : "";
    return `- ${icon} **${r.check}** — ${r.detail}${repairTag}`;
  }),
  ``,
  `---`,
  `*Rapport généré automatiquement par scripts/health-check.mjs. Colle ce fichier (ou data/health-report.json) à Claude pour un suivi technique.*`,
].join("\n");

writeFileSync("data/health-report.md", md);

console.log(md);
console.log(`\n${fails > 0 ? "❌ Échecs détectés." : "✅ Contrôle terminé."}`);
