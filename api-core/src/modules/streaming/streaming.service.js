const fs = require('fs');
const path = require('path');
const Playback = require('./playback.model');
const Movie = require('../catalog/movie.model');
const Episode = require('../catalog/episode.model');
const mongoose = require('mongoose');
const tmdbProvider = require('../catalog/providers/tmdb.provider');

// Tipos MIME por extensión
const MIME_TYPES = {
    '.mp4':  'video/mp4',
    '.mkv':  'video/x-matroska',
    '.webm': 'video/webm',
    '.avi':  'video/x-msvideo',
    '.mov':  'video/quicktime',
};

const CHUNK_SIZE = 1024 * 1024; // 1 MB por fragmento por defecto

function validateVideoFile(filePath) {
    if (!fs.existsSync(filePath)) {
        const err = new Error('Archivo de video no encontrado en el servidor');
        err.statusCode = 404;
        throw err;
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME_TYPES[ext]) {
        const err = new Error(`Formato de video no soportado: ${ext}`);
        err.statusCode = 415;
        throw err;
    }
    return { ext, mimeType: MIME_TYPES[ext] };
}

function parseRange(rangeHeader, fileSize) {
    if (!rangeHeader) return null;

    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return null;

    const start = match[1] !== '' ? parseInt(match[1], 10) : 0;
    const end   = match[2] !== '' ? parseInt(match[2], 10) : fileSize - 1;

    if (start > end || end >= fileSize) {
        const err = new Error('Rango de bytes fuera de límites');
        err.statusCode = 416;
        err.headers = { 'Content-Range': `bytes */${fileSize}` };
        throw err;
    }

    return { start, end };
}

/**
 * Escribe la respuesta de streaming al objeto `res` de Express.
 * Soporta 206 Partial Content (Range Requests) y 200 completo.
 *
 * @param {string} filePath - Ruta absoluta al archivo de video
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function streamVideo(filePath, req, res) {
    const { mimeType } = validateVideoFile(filePath);
    const { size: fileSize } = fs.statSync(filePath);

    const range = parseRange(req.headers['range'], fileSize);

    const onStreamError = (err) => {
        console.error(`[streaming] Error leyendo archivo ${filePath}: ${err.message}`);
        if (!res.headersSent) res.status(500).end();
        else res.end();
    };

    if (range) {
        const { start, end } = range;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges':  'bytes',
            'Content-Length': chunkSize,
            'Content-Type':   mimeType,
        });

        fs.createReadStream(filePath, { start, end })
            .on('error', onStreamError)
            .pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type':   mimeType,
            'Accept-Ranges':  'bytes',
        });

        fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE })
            .on('error', onStreamError)
            .pipe(res);
    }
}

async function saveOrUpdateProgress(userId, contentId, currentTime, duration) {
    const filter = { userId, contentId };
    const update = { currentTime, duration, lastWatched: new Date() };
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    return Playback.findOneAndUpdate(filter, update, options).exec();
}

async function getProgress(userId, contentId) {
    return Playback.findOne({ userId, contentId }).exec();
}

async function populateContentGeneric(playbacks) {
    if (!playbacks || playbacks.length === 0) return playbacks;

    const contentIds = playbacks.map(p => String(p.contentId));
    
    const objectIds = contentIds.filter(id => mongoose.isValidObjectId(id));
    const tmdbIds = contentIds.filter(id => !mongoose.isValidObjectId(id));

    const movies = await Movie.find({ _id: { $in: objectIds } }).lean();
    const episodes = await Episode.find({ _id: { $in: objectIds } }).populate('tvshowId').lean();

    const movieMap = {};
    movies.forEach(m => movieMap[m._id.toString()] = { ...m, type: 'movie' });
    
    const episodeMap = {};
    episodes.forEach(e => episodeMap[e._id.toString()] = { ...e, type: 'series' });

    if (tmdbIds.length > 0) {
        const tmdbMovies = await Promise.all(
            tmdbIds.map(id => tmdbProvider.getMovieDetails(id).catch(() => null))
        );
        tmdbMovies.forEach(m => {
            if (m) {
                movieMap[m.id.toString()] = { ...m, type: 'movie' };
            }
        });
    }

    return playbacks.map(p => {
        const idStr = String(p.contentId);
        p.contentId = movieMap[idStr] || episodeMap[idStr] || p.contentId;
        return p;
    });
}

async function getContinueWatchingList(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = {
        userId,
        $expr: { $lt: ['$currentTime', '$duration'] }
    };

    const total = await Playback.countDocuments(query);
    const playbacks = await Playback.find(query)
        .sort({ lastWatched: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

    let list = await populateContentGeneric(playbacks);

    // Adaptamos el formato para que coincida con lo que espera el frontend (ContinueWatching.jsx)
    list = list.map(entry => {
        const percentWatched = entry.duration ? Math.round((entry.currentTime / entry.duration) * 100) : 0;
        const contentType = (entry.contentId && entry.contentId.type === 'series') ? 'TVShow' : 'Movie';
        
        return {
            _id: entry._id,
            contentId: entry.contentId?._id || entry.contentId,
            contentType,
            percentWatched,
            currentTime: entry.currentTime,
            item: entry.contentId // El objeto poblado
        };
    });

    return {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        list
    };
}

async function getHistory(userId, filters = {}) {
    const query = { userId };
    
    if (filters.from || filters.to) {
        query.lastWatched = {};
        if (filters.from) {
            query.lastWatched.$gte = new Date(filters.from);
        }
        if (filters.to) {
            const toDate = new Date(filters.to);
            toDate.setHours(23, 59, 59, 999);
            query.lastWatched.$lte = toDate;
        }
    }
    
    let playbacks = await Playback.find(query)
        .sort({ lastWatched: -1 })
        .lean()
        .exec();

    playbacks = await populateContentGeneric(playbacks);

    if (filters.type) {
        const typeMatch = filters.type === 'movie' ? 'movie' : 'series';
        playbacks = playbacks.filter(p => p.contentId && p.contentId.type === typeMatch);
    }
    
    return playbacks;
}

module.exports = {
    streamVideo,
    validateVideoFile,
    saveOrUpdateProgress,
    getProgress,
    getContinueWatchingList,
    getHistory,
};
