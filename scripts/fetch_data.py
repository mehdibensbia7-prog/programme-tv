import requests
import json
import os
import time

# Récupération de la clé depuis les secrets GitHub
API_KEY = os.getenv('TMDB_API_KEY')
BASE_URL = "https://api.themoviedb.org/3"

def fetch_data():
    url = f"{BASE_URL}/tv/on_the_air?api_key={API_KEY}&language=fr-FR"
    response = requests.get(url)
    data = response.json()

    items = []
    # On limite à 5 séries pour ne pas surcharger la page
    for show in data.get('results', [])[:5]:
        items.append({
            "title": show['name'],
            "season": "En cours",
            "date": show.get('first_air_date', 'N/A'),
            "link": f"https://www.themoviedb.org/tv/{show['id']}",
            "image": f"https://image.tmdb.org/t/p/w500{show['poster_path']}",
            "desc": (show['overview'][:80] + '...') if show['overview'] else "Pas de résumé."
        })

    with open('data/videos.json', 'w', encoding='utf-8') as f:
        json.dump({"updatedAt": int(time.time() * 1000), "items": items}, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    fetch_data()
