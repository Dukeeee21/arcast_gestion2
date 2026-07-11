const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5000';

// Mapeo de géneros en español (TMDB) al vocabulario del motor de IA
const GENRE_MAP = {
    'Action':    'Acción',
    'Acción':    'Acción',
    'Science Fiction': 'Sci-Fi',
    'Sci-Fi':    'Sci-Fi',
    'Drama':     'Drama',
    'Horror':    'Terror',
    'Terror':    'Terror',
    'Comedy':    'Comedia',
    'Comedia':   'Comedia',
    'Adventure': 'Aventura',
    'Aventura':  'Aventura',
    'Romance':   'Romance',
    'Thriller':  'Thriller',
    'Animation': 'Animación',
    'Animación': 'Animación',
    'Fantasy':   'Aventura',
    'Family':    'Animación',
};

/**
 * Extrae géneros preferidos del historial de visualización del usuario.
 * Los géneros más vistos tienen mayor peso.
 */
function extractPreferredGenres(watchHistory, watchlist) {
    const genreCount = {};

    const processGenres = (genres = []) => {
        genres.forEach(g => {
            const mapped = GENRE_MAP[g] || g;
            genreCount[mapped] = (genreCount[mapped] || 0) + 1;
        });
    };

    // El historial vale doble que la watchlist
    watchHistory.forEach(entry => {
        if (entry.genres) processGenres(entry.genres);
    });

    watchlist.forEach(entry => {
        if (entry.genres) processGenres(entry.genres);
    });

    // Ordenar por frecuencia descendente
    return Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre);
}

/**
 * Llama al ai-engine para obtener recomendaciones y
 * filtra los tmdbIds ya vistos por el usuario.
 */
async function getRecommendations(userId, preferredGenres, watchedIds, limit = 5) {
    const { data } = await axios.post(`${AI_ENGINE_URL}/recommend`, {
        userId,
        preferredGenres: preferredGenres.length ? preferredGenres : ['Acción'],
        limit: limit + watchedIds.length, // pide de más para poder filtrar los ya vistos
    });

    const seen = new Set(watchedIds.map(String));
    const filtered = (data.recommendations || []).filter(id => !seen.has(String(id)));

    return {
        recommendations: filtered.slice(0, limit),
        engine: data.engine,
        metadata: {
            ...data.metadata,
            filteredAlreadyWatched: watchedIds.length,
        },
    };
}

module.exports = { extractPreferredGenres, getRecommendations };
