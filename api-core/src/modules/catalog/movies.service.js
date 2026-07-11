/**
 * @type {any}
 */
const Movie = require('./movie.model');

exports.create = async (data) => {
    return new Movie(data).save();
};

exports.findAll = async (query, sort, search) => {
    let finalQuery = { ...query };
    
    // Filtro nativo en MongoDB para el buscador
    if (search) {
        finalQuery.title = { $regex: search, $options: 'i' };
    }

    if (!sort && !search) {
        const movies = await Movie.find(finalQuery);
        return movies.sort(() => Math.random() - 0.5);
    }

    let sortOption = { _id: -1 };
    if (sort === 'rating') sortOption = { voteAverage: -1 };
    if (sort === 'newest') sortOption = { releaseDate: -1 };

    return Movie.find(finalQuery).sort(sortOption);
};

exports.findById = async (id) => {
    const movie = await Movie.findById(id);
    if (!movie) return null;
    
    // Convertimos a objeto para inyectar la URL del trailer que React espera
    const movieObj = movie.toObject();
    if (movieObj.trailerKey) {
        movieObj.trailerUrl = `https://www.youtube.com/watch?v=${movieObj.trailerKey}`;
    }
    return movieObj;
};

// Funciones añadidas para reemplazar a TMDB
exports.getDetails = exports.findById;
exports.search = async (queryTerm) => {
    return Movie.find({ title: { $regex: queryTerm, $options: 'i' } });
};

exports.update = async (id, data) => Movie.findByIdAndUpdate(id, data, { new: true });

// Borrado LÓGICO: marca la fecha/autor sin destruir el documento.
exports.softDelete = async (id, username) =>
    Movie.findByIdAndUpdate(
        id,
        { deletedAt: new Date(), deletedBy: username || 'system', visible: false },
        { new: true },
    );

// Listado de gestión para admin/técnico (incluye borradores, pendientes, ocultos).
exports.findManaged = async (filter = {}) =>
    Movie.find(filter).sort({ updatedAt: -1, _id: -1 });

// Borrado físico: reservado para tareas de mantenimiento, NO para la UI.
exports.hardDelete = async (id) => Movie.findByIdAndDelete(id);
