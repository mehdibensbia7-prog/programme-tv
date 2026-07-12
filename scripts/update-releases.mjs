// scripts/update-releases.mjs
// Génère data/films-releases.json et data/series-releases.json
// Nécessite le secret GitHub TMDB_API_KEY (déjà utilisé par vos autres scripts)

import { writeFileSync, mkdirSync } from "fs";

const API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

if (!API_KEY) {
  console.error("TMDB_API_KEY manquant dans les secrets GitHub.");
  process.exit(1);
}

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}api_key=${API_KEY}&language=fr-FR`);
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json();
}

// Traduit les codes fournisseurs TMDB en noms lisibles
function platformFromProviders(providers) {
  const fr = providers?.results?.FR;
  if (!fr) return null;
  const list = fr.flatrate || fr.ads || fr.free || null;
  if (list && list.length) return list[0].provider_name;
  if (fr.rent && fr.rent.length) return fr.rent[0].provider_name + " (location)";
  if (fr.buy && fr.buy.length) return fr.buy[0].provider_name + " (achat)";
  return null;
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// ---------- FILMS : sorties à venir ----------
async function updateFilms() {
  try {
    console.log("Récupération des sorties films (TMDB /movie/upcoming)...");
    const data = await tmdb("/movie/upcoming?region=FR&page=1");
    const movies = (data.results || []).slice(0, 8);

    const items = [];
    for (const m of movies) {
      let platform = null;
      try {
        const providers = await tmdb(`/movie/${m.id}/watch/providers`);
        platform = platformFromProviders(providers);
      } catch (e) { /* pas grave si ça échoue pour un film */ }

      items.push({
        title: m.title,
        image: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : "",
        link: `https://www.themoviedb.org/movie/${m.id}`,
        synopsis: m.overview ? m.overview.slice(0, 160) + "…" : "Aucun synopsis disponible.",
        releaseDate: formatDate(m.release_date),
        platform: platform || (m.release_date ? "Sortie cinéma" : null),
        category: platform ? "streaming" : "cinema"
      });
    }

    mkdirSync("data", { recursive: true });
    writeFileSync("data/films-releases.json", JSON.stringify({ updatedAt: Date.now(), items }, null, 2));
    console.log(`films-releases.json mis à jour (${items.length} films).`);
  } catch (e) {
    console.error("Erreur Films:", e.message);
  }
}

// ---------- SÉRIES : statut, épisodes, prochain épisode, plateforme ----------
async function updateSeries() {
  try {
    console.log("Récupération des séries en cours (TMDB /tv/on_the_air)...");
    const data = await tmdb("/tv/on_the_air?page=1");
    const shows = (data.results || []).slice(0, 8);

    const items = [];
    for (const s of shows) {
      let detail = null;
      let platform = null;
      try {
        detail = await tmdb(`/tv/${s.id}`);
      } catch (e) { /* on garde les infos de base si le détail échoue */ }
      try {
        const providers = await tmdb(`/tv/${s.id}/watch/providers`);
        platform = platformFromProviders(providers);
      } catch (e) { /* pas grave */ }

      const inProduction = detail ? detail.in_production : true;
      const nextEp = detail?.next_episode_to_air;
      const totalEpisodes = detail?.number_of_episodes;
      const totalSeasons = detail?.number_of_seasons;

      items.push({
        title: s.name,
        image: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : "",
        link: `https://www.themoviedb.org/tv/${s.id}`,
        synopsis: s.overview ? s.overview.slice(0, 160) + "…" : "Aucun résumé disponible.",
        status: inProduction ? "En cours" : "Terminée",
        episodes: (totalSeasons && totalEpisodes)
          ? `${totalSeasons} saison${totalSeasons > 1 ? "s" : ""} · ${totalEpisodes} épisodes`
          : null,
        nextEpisodeDate: nextEp ? formatDate(nextEp.air_date) : null,
        platform: platform || null
      });
    }

    mkdirSync("data", { recursive: true });
    writeFileSync("data/series-releases.json", JSON.stringify({ updatedAt: Date.now(), items }, null, 2));
    console.log(`series-releases.json mis à jour (${items.length} séries).`);
  } catch (e) {
    console.error("Erreur Séries:", e.message);
  }
}

async function run() {
  await updateFilms();
  await updateSeries();
}

run();
