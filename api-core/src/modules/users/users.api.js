/**
 * @type {any}
 */
const User = require('./user.model');

module.exports = {
    /**
     * Busca un usuario por email o nombre de usuario.
     */
    findByEmailOrUsername: async (email, username) => {
        // noinspection JSUnresolvedFunction
        return User.findOne({ $or: [{ email }, { username }] });
    },

    /**
     * Busca un usuario por email.
     */
    findByEmail: async (email) => {
        // noinspection JSUnresolvedFunction
        return User.findOne({ email });
    },

    /**
     * Crea y persiste un nuevo usuario.
     */
    createUser: async (userData) => {
        const user = new User(userData);
        // noinspection JSUnresolvedFunction
        return user.save();
    }
};