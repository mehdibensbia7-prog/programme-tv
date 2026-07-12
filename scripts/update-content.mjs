// Ce script tourne UNIQUEMENT sur les serveurs GitHub Actions, jamais dans le navigateur.
// Les clés sont lues depuis les variables d'environnement (GitHub Secrets), jamais écrites en dur.
import { writeFileSync, mkdirSync } from "fs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!res.ok) {
      console.error("Gemini HTTP", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    console.error("Erreur Gemini:", e.message);
    return null;
  }
}

async function updateNews() {
  try {
    const res = await fetch(
      "https://api.rss2json.com/v1/api.json?rss_url=https://www.allocine.fr/rss/news.xml"
    );
    const data = await res.json();
    const items = [];
    if (data.status === "ok") {
      for (const item of data.items.slice(0, 6)) {
        const cleanDesc = (item.description || "").replace(/<[^>]*>/g, "");
        const prompt = `Prends ce résumé d'actualité cinématographique : "${cleanDesc}". Réécris-le en UNE SEULE PHRASE choc et captivante, style grand titre de presse. Pas de markdown, texte brut, 25 mots maximum.`;
        const aiText = await askGemini(prompt);
        items.push({
          title: item.title || "Actualité Ciné",
          link: item.link || "#",
          desc: aiText || cleanDesc.slice(0, 140) + "...",
          isAI: !!aiText,
        });
      }
    }
    mkdirSync("data", { recursive: true });
    writeFileSync(
      "data/news-ai.json",
      JSON.stringify({ updatedAt: Date.now(), items }, null, 2)
    );
    console.log(`data/news-ai.json écrit : ${items.length} items`);
  } catch (e) {
    console.error("Échec mise à jour actus:", e.message);
  }
}

async function updateTrends() {
  if (!TMDB_API_KEY) {
    console.log("Pas de clé TMDB configurée — section tendances ignorée.");
    return;
  }
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=fr-FR`
    );
    const data = await res.json();
    const items = [];
    if (data.results) {
      for (const movie of data.results.slice(0, 6)) {
        const prompt = `Rends le synopsis de ce film ultra attirant en une phrase choc qui donne envie de le voir ce soir. Titre: ${movie.title}. Synopsis: ${movie.overview || "Inconnu"}. Pas de markdown, texte brut, 25 mots maximum.`;
        const aiText = await askGemini(prompt);
        items.push({
          title: movie.title || movie.original_title || "Film Tendance",
          id: movie.id,
          desc: aiText || (movie.overview ? movie.overview.slice(0, 140) + "..." : "Aucun synopsis disponible."),
          vote: movie.vote_average || 0,
          isAI: !!aiText,
        });
      }
    }
    mkdirSync("data", { recursive: true });
    writeFileSync(
      "data/trends-ai.json",
      JSON.stringify({ updatedAt: Date.now(), items }, null, 2)
    );
    console.log(`data/trends-ai.json écrit : ${items.length} items`);
  } catch (e) {
    console.error("Échec mise à jour tendances:", e.message);
  }
}

await updateNews();
await updateTrends();
