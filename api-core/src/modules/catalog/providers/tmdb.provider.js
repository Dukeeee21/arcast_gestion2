const axios = require('axios');
const { AppError } = require('../../../common/error.utils');

const getMovieDetails = async (id) => {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/${id}`, {
            params: { api_key: process.env.TMDB_API_KEY, language: 'es-ES' }
        });
        const d = res.data;

        return {
            title: d.title,
            overview: d.overview,
            posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
            backdropUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : null,
            tmdbId: String(d.id),
            releaseDate: d.release_date,
            voteAverage: d.vote_average,
            originCountry: d.origin_country || [],
            productionCountries: (d.production_countries || []).map(c => c.iso_3166_1)
        };
    } catch (err) {
        throw new AppError('Error al conectar con el proveedor TMDB', 502);
    }
};

const getPeruvianMovies = async (page = 1) => {
    try {
        const res = await axios.get('https://api.themoviedb.org/3/discover/movie', {
            params: {
                api_key: process.env.TMDB_API_KEY,
                language: 'es-ES',
                with_origin_country: 'PE',
                page
            }
        });

        return {
            results: res.data.results,
            totalPages: res.data.total_pages
        };
    } catch (err) {
        throw new AppError('Error al obtener películas peruanas de TMDB', 502);
    }
};

const explorePeruvianMovies = async (page = 1, filters = {}) => {
    try {
        const { genre, sort, search } = filters;

        // Rescatamos su default para mostrar las más conocidas primero
        let sortBy = 'vote_count.desc'; 
        if (sort === 'rating') sortBy = 'vote_average.desc';
        if (sort === 'newest') sortBy = 'primary_release_date.desc';

        const params = {
            api_key: process.env.TMDB_API_KEY,
            language: 'es-ES',
            with_origin_country: 'PE',
            page,
            sort_by: sortBy,
            'primary_release_date.lte': '2024-12-31',  // Rescate: solo hasta 2024
            'vote_count.gte': 5  // Rescate: mínimo 5 valoraciones
        };

        if (search) {
            const res = await axios.get('https://api.themoviedb.org/3/search/movie', {
                params: {
                    api_key: process.env.TMDB_API_KEY,
                    language: 'es-ES',
                    query: search,
                    region: 'PE',
                    page
                }
            });
            const results = res.data.results.filter(m => 
                m.origin_country && m.origin_country.includes('PE')
            );
            return { results, totalPages: res.data.total_pages };
        }

        if (genre) params.with_genres = genre;

        const res = await axios.get('https://api.themoviedb.org/3/discover/movie', { params });
        return { results: res.data.results, totalPages: res.data.total_pages };

    } catch (err) {
        throw new AppError('Error al explorar películas peruanas en TMDB', 502);
    }
};

const getTVShowDetails = async (id) => {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
            params: { api_key: process.env.TMDB_API_KEY, language: 'es-ES' }
        });
        const d = res.data;

        return {
            // Mapeo crucial: TMDB usa 'name' para series, lo pasamos a 'title' o lo guardamos como 'name'
            title: d.name, 
            overview: d.overview,
            posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
            backdropUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : null,
            tmdbId: String(d.id),
            releaseDate: d.first_air_date, // TMDB usa 'first_air_date' para series
            voteAverage: d.vote_average,
            originCountry: d.origin_country || [],
            productionCountries: (d.production_countries || []).map(c => c.iso_3166_1)
        };
    } catch (err) {
        throw new AppError('Error al conectar con el proveedor TMDB para TV', 502);
    }
};

module.exports = { getMovieDetails, getPeruvianMovies, explorePeruvianMovies, getTVShowDetails };
