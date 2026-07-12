import { writeFileSync, mkdirSync } from "fs";

// Utilisation des variables d'environnement (GitHub Secrets)
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function run() {
  mkdirSync("data", { recursive: true });
  
  // 1. Récupération des NEWS
  try {
    const res = await fetch("https://api.rss2json.com/v1/api.json?rss_url=https://www.allocine.fr/rss/news.xml");
    const data = await res.json();
    const items = [];
    if (data.status === "ok") {
      for (const item of data.items.slice(0, 6)) {
        const cleanDesc = (item.description || "").replace(/<[^>]*>/g, "");
        items.push({ 
          title: item.title, 
          link: item.link, 
          desc: cleanDesc.slice(0, 140) 
        });
      }
    }
    // Écriture avec la clé "items"
    writeFileSync("data/news-ai.json", JSON.stringify({ updatedAt: Date.now(), items }, null, 2));
    console.log("News mises à jour.");
  } catch (e) { console.error("Erreur News:", e); }

  // 2. Récupération des TENDANCES (Corrigé pour inclure un lien)
  try {
    if (TMDB_API_KEY) {
      const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=fr-FR`);
      const data = await res.json();
      
      const items = (data.results || []).slice(0, 6).map(m => ({ 
        title: m.title, 
        // Ajout du lien vers la fiche du film pour correspondre à votre index.html
        link: `https://www.themoviedb.org/movie/${m.id}`, 
        desc: m.overview?.slice(0, 140) || "Aucun synopsis." 
      }));
      
      // Écriture avec la clé "items"
      writeFileSync("data/trends-ai.json", JSON.stringify({ updatedAt: Date.now(), items }, null, 2));
      console.log("Tendances mises à jour.");
    }
  } catch (e) { console.error("Erreur Trends:", e); }
}

run();
