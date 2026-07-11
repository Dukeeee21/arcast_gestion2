from flask import Flask, request, jsonify
import random
from collections import Counter

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Base de conocimiento: IDs reales de TMDB agrupados por género
# Se usa filtrado de contenido (content-based filtering) para recomendar.
# ---------------------------------------------------------------------------
CONTENT_DATABASE = {
    "Acción":    ["550", "155", "272", "24428", "299534", "76341", "99861", "284053"],
    "Sci-Fi":    ["157336", "27205", "121", "11", "603", "181808", "260513", "351286"],
    "Drama":     ["680", "13", "122", "278", "238", "598", "372058", "497"],
    "Terror":    ["420634", "135335", "301528", "694", "348", "745"],
    "Comedia":   ["13", "218", "862", "10193", "585"],
    "Aventura":  ["120", "121", "122", "329", "672"],
    "Romance":   ["11216", "313369", "15121", "423", "76203"],
    "Thriller":  ["680", "807", "311", "9552", "106"],
    "Animación": ["862", "10193", "260513", "585", "301528"],
}

# Pesos por posición (el primer género preferido vale más)
GENRE_WEIGHTS = [3, 2, 1.5, 1, 1, 1, 1, 1]


def _score_candidates(user_genres: list) -> list:
    """
    Scoring ponderado por género:
    - Cada ID de TMDB acumula puntos según el peso de los géneros que lo contienen.
    - Los IDs que aparecen en múltiples géneros favoritos suman puntos de todos ellos.
    - Retorna los IDs ordenados de mayor a menor puntuación.
    """
    score = Counter()

    for idx, genre in enumerate(user_genres):
        weight = GENRE_WEIGHTS[idx] if idx < len(GENRE_WEIGHTS) else 1.0
        for content_id in CONTENT_DATABASE.get(genre, []):
            score[content_id] += weight

    if not score:
        return random.sample(CONTENT_DATABASE["Acción"], k=3)

    # Orden descendente; desempate aleatorio para variedad
    ranked = sorted(score.keys(), key=lambda cid: (-score[cid], random.random()))
    return ranked


@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud para Docker healthcheck y monitoreo externo."""
    return jsonify({"status": "ok", "engine": "Arcast-ContentEngine-v1"}), 200


@app.route('/recommend', methods=['POST'])
def recommend():
    """
    Motor de recomendación por filtrado de contenido (Content-Based Filtering).

    Payload:
    {
        "userId":          "abc123",
        "preferredGenres": ["Sci-Fi", "Acción"],  <- orden = prioridad
        "limit":           5                       <- opcional, máx 10
    }

    Respuesta:
    {
        "recommendations": ["157336", "603", "550", ...],
        "engine": "Arcast-ContentEngine-v1",
        "metadata": { ... }
    }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}

        user_id     = data.get('userId', 'anonymous')
        raw_genres  = data.get('preferredGenres') or ["Acción"]
        limit       = min(int(data.get('limit', 5)), 10)

        # Saneamos la entrada
        user_genres = [g for g in raw_genres if isinstance(g, str)]
        if not user_genres:
            user_genres = ["Acción"]

        ranked_ids           = _score_candidates(user_genres)
        final_recommendations = ranked_ids[:limit]

        valid_genres   = [g for g in user_genres if g in CONTENT_DATABASE]
        unknown_genres = [g for g in user_genres if g not in CONTENT_DATABASE]

        return jsonify({
            "recommendations": final_recommendations,
            "engine": "Arcast-ContentEngine-v1",
            "metadata": {
                "userId":             user_id,
                "requestedGenres":    user_genres,
                "recognizedGenres":   valid_genres,
                "unrecognizedGenres": unknown_genres,
                "totalCandidates":    len(ranked_ids),
                "returnedCount":      len(final_recommendations),
            }
        }), 200

    except Exception as e:
        app.logger.error(f"[RECOMMEND ERROR] {e}")
        return jsonify({
            "error":  "Error interno del motor de recomendaciones.",
            "detail": str(e)
        }), 500


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
