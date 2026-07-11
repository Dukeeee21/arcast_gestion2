const searchService = require('./search.service');
const { AppError } = require('../../common/error.utils');

const semanticSearch = async (req, res, next) => {
    try {
        const { query } = req.body;
        
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return next(new AppError('El campo "query" es obligatorio y debe ser un texto.', 400));
        }

        const results = await searchService.performSemanticSearch(query);
        
        res.status(200).json({
            status: 'success',
            data: results
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    semanticSearch
};
