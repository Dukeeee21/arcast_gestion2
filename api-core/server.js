require('dotenv').config();
const express = require('express');
const cors    = require('cors');

/** @type {function(): void} */
const connectDB = (/** @type {any} */ (require('./src/common/db')));
const { AppError } = require('./src/common/error.utils');

const app = express();

// Conectamos a Mongo y, una vez listo, ejecutamos el arranque automático
// (crear cuentas base y, si corresponde, sembrar el catálogo).
const { runBootstrap } = require('./src/common/bootstrap');
connectDB().then(() => runBootstrap());

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.get('/api/system/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
// ─── Módulos de negocio ────────────────────────────────────────────────────
/** @type {any} */ const authModule            = require('./src/modules/auth');
/** @type {any} */ const usersModule           = require('./src/modules/users');
/** @type {any} */ const catalogModule         = require('./src/modules/catalog');
/** @type {any} */ const reviewsModule         = require('./src/modules/reviews');
/** @type {any} */ const systemModule          = require('./src/modules/system');
/** @type {any} */ const streamingModule       = require('./src/modules/streaming');
/** @type {any} */ const searchModule          = require('./src/modules/search');
/** @type {any} */ const recommendationsModule = require('./src/modules/recommendations');
/** @type {any} */ const statisticsModule      = require('./src/modules/statistics');
/** @type {any} */ const annotationsModule     = require('./src/modules/annotations');
/** @type {any} */ const citationsModule        = require('./src/modules/citations');

// --- REGISTRO DE MÓDULOS (MONOLITO MODULAR) ---
app.use('/api/auth',            authModule);
app.use('/api/users',           usersModule);
app.use('/api/catalog',         catalogModule);
app.use('/api/reviews',         reviewsModule);
app.use('/api/system',          systemModule);
app.use('/api/stream',          streamingModule);
app.use('/api/search',          searchModule);
app.use('/api/recommendations', recommendationsModule);
app.use('/api/statistics',      statisticsModule);
app.use('/api/annotations',     annotationsModule);
app.use('/api/citations',       citationsModule);

// ─── 404 — Ruta no encontrada ──────────────────────────────────────────────
app.use((req, _res, next) => {
    next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
});

// ─── Manejador global de errores (centralizado) ────────────────────────────
/**
 * Express detecta un error handler por la aridad de 4 parámetros (err, req, res, next).
 * Todos los errores lanzados con `next(err)` o `throw` dentro de `catchAsync` llegan aquí.
 *
 * @type {import('express').ErrorRequestHandler}
 */
const globalErrorHandler = (err, req, res, _next) => {
    const status  = err.status     || 'error';
    const code    = err.statusCode || err.status || 500;
    const message = err.message    || 'Error interno del servidor';

    // Enriquecer log con contexto
    console.error(`[${new Date().toISOString()}] [${req.method} ${req.originalUrl}] ${code} — ${message}`);

    // En producción ocultamos el stack trace
    const isDevMode = process.env.NODE_ENV === 'development';

    (/** @type {any} */ (res)).status(code).json({
        status,
        message,
        ...(isDevMode && { stack: err.stack }),
    });
};

app.use(globalErrorHandler);

// ─── Inicio ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`✅  Backend Arcast listo en puerto ${PORT}`));
