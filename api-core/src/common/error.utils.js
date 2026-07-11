// noinspection JSUnusedGlobalSymbols
class AppError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode
     */
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Wrapper para eliminar try/catch y pasar errores al manejador global.
 * @param {Function} fn
 */
// noinspection JSUnusedGlobalSymbols
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

module.exports = { AppError, catchAsync };