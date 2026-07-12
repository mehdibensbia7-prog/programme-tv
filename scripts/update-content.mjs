import { writeFileSync, mkdirSync } from "fs";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function run() {
  mkdirSync("data", { recursive: true });
  
  // 1. News Allociné
  try {
    const res = await fetch("https://api.rss2json.com/v1/api.json?rss_url=https://www.allocine.fr/rss/news.xml");
    const data = await res.json();
    const items = (data.items || []).slice(0, 5).map(i => ({
      title: i.title, link: i.link, desc: i.description?.replace(/<[^>]*>/g, "").slice(0, 80) + "..."
    }));
    writeFileSync("data/news-ai.json", JSON.stringify({ items }, null, 2));
  } catch (e) { console.error(e); }

  // 2. Tendances TMDB (avec affiches)
  try {
    const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}&language=fr-FR`);
    const data = await res.json();
    const items = (data.results || []).slice(0, 5).map(m => ({ 
      title: m.title, 
      link: `https://www.themoviedb.org/movie/${m.id}`,
      image: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : null,
      desc: m.overview?.slice(0, 80) + "..."
    }));
    writeFileSync("data/trends-ai.json", JSON.stringify({ items }, null, 2));
  } catch (e) { console.error(e); }
}
run();
