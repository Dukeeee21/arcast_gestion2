/**
 * @type {any}
 */
const TVShow = require('./tvshow.model');

exports.findAll = async (query, sortOption, search) => {
    let finalQuery = { ...query };
    if (search) {
        finalQuery.name = { $regex: search, $options: 'i' };
    }
    return TVShow.find(finalQuery).sort(sortOption || { _id: -1 });
};

exports.findById = async (id) => {
    const show = await TVShow.findById(id);
    if (!show) return null;

    const showObj = show.toObject();
    if (showObj.trailerKey) {
        showObj.trailerUrl = `https://www.youtube.com/watch?v=${showObj.trailerKey}`;
    }
    return showObj;
};

// Funciones añadidas para reemplazar a TMDB
exports.getDetails = exports.findById;
exports.search = async (queryTerm) => {
    return TVShow.find({ name: { $regex: queryTerm, $options: 'i' } });
};

exports.create = async (data) => TVShow.create(data);
exports.update = async (id, data) => TVShow.findByIdAndUpdate(id, data, { new: true });
exports.delete = async (id) => TVShow.findByIdAndDelete(id);
