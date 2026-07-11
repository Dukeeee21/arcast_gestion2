/**
 * @type {any}
 */
const Review = require('./review.model');

/**
 * @param {string} userId - ID del usuario a consultar.
 * @returns {Promise<Array>} Promesa con el array de reseñas.
 */
exports.getReviewsByUserId = async (userId) => {
    // noinspection JSUnresolvedFunction
    return Review.find({ userId }).sort({ date: -1 });
};

/**
 * @returns {Promise<number>}
 */
exports.getTotalCount = async () => {
    // noinspection JSUnresolvedFunction
    return Review.countDocuments();
};