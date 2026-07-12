// scripts/update-content.mjs
import fs from 'fs/promises';

// Votre clé API doit être définie dans les secrets GitHub sous le nom TMDB_API_KEY
const API_KEY = process.env.TMDB_API_KEY;

async function updateVideos() {
    try {
        console.log("Début de la mise à jour des vidéos...");

        // 1. Appel vers l'API TMDB pour les séries en cours de diffusion
        const response = await fetch(`https://api.themoviedb.org/3/tv/on_the_air?api_key=${API_KEY}&language=fr-FR`);
        if (!response.ok) throw new Error(`Erreur API TMDB: ${response.statusText}`);
        
        const data = await response.json();
        
        // 2. Transformation des données brutes en format compatible avec votre HTML
        const newItems = data.results.slice(0, 5).map(show => ({
            title: show.name,
            season: "En cours",
            date: show.first_air_date || 'N/A',
            link: `https://www.themoviedb.org/tv/${show.id}`,
            image: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : '',
            desc: show.overview ? show.overview.substring(0, 80) + '...' : "Pas de résumé."
        }));

        // 3. Fusion sécurisée avec les données existantes
        let existingItems = [];
        try {
            const rawData = await fs.readFile('./data/videos.json', 'utf-8');
            const parsedData = JSON.parse(rawData);
            existingItems = parsedData.items || [];
        } catch (e) {
            console.log("Aucun fichier existant trouvé ou format invalide, création d'une nouvelle liste.");
        }

        // On combine les nouveaux items avec les anciens, puis on limite à 10 éléments
        const combinedItems = [...newItems, ...existingItems].slice(0, 10);

        // 4. Écriture du fichier JSON final
        await fs.writeFile('./data/videos.json', JSON.stringify({ items: combinedItems }, null, 2));
        console.log("Mise à jour réussie : 10 éléments stockés dans data/videos.json.");
        
    } catch (error) {
        console.error("Erreur lors de la mise à jour :", error);
        process.exit(1); // Force le workflow à échouer si une erreur critique survient
    }
}

updateVideos();
