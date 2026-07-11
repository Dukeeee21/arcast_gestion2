/**
 * Seed INSTITUCIONAL — datos de demostración para el Archivo Audiovisual.
 *
 * - Cataloga las 11 películas peruanas de la carpeta media/ con ficha completa
 *   (región, lengua, fondo, año, presupuesto, derechos) y las conecta por localPath.
 * - Crea usuarios con región y roles (investigador, técnico, supervisor, jefe).
 * - Genera reproducciones GEORREFERENCIADAS por departamento (enciende el mapa de
 *   impacto territorial y el Retorno Estatal del Dashboard).
 * - Siembra anotaciones y citas de ejemplo para el workspace.
 *
 * Idempotente: upsert por título; las reproducciones sólo se generan si aún no hay.
 *
 * Uso manual:  docker-compose exec api-core node seed-institucional.js
 * Automático:  AUTO_SEED_INSTITUTIONAL=true (ver bootstrap + docker-compose).
 */
const mongoose = require('mongoose');
require('dotenv').config();

/** @type {any} */ const Movie = require('./src/modules/catalog/movie.model');
/** @type {any} */ const User = require('./src/modules/users/user.model');
/** @type {any} */ const PlaybackLog = require('./src/modules/statistics/playback.model');
/** @type {any} */ const Annotation = require('./src/modules/annotations/annotation.model');
/** @type {any} */ const Citation = require('./src/modules/citations/citation.model');

const M = (file) => `/media/${file}`;

// Ficha de cada película (metadatos reales aproximados + archivo en media/).
const PELICULAS = [
    { title: 'Contracorriente', anio: 2009, region: 'Costa', lengua: 'Español', fondoEstatal: 'Estímulos Económicos (DAFO)', director: 'Javier Fuentes-León', productionCompany: 'Dynamo', duration: 100, presupuestoAprobado: 2800000, localPath: M('CONTRACORRIENTE.mp4'), overview: 'Un pescador en un pueblo costero enfrenta el conflicto entre su comunidad tradicional y un amor secreto.', estadoPublicacion: 'Aprobado' },
    { title: 'La Teta Asustada', anio: 2009, region: 'Sierra', lengua: 'Quechua', fondoEstatal: 'Fondo Histórico Nacional', director: 'Claudia Llosa', productionCompany: 'Oberón Cinematográfica', duration: 95, presupuestoAprobado: 3200000, localPath: M('LA TETA ASUSTADA.mp4'), overview: 'Fausta padece una enfermedad transmitida por la leche materna de mujeres violentadas durante el terrorismo.', estadoPublicacion: 'Aprobado' },
    { title: 'La Boca del Lobo', anio: 1988, region: 'Sierra', lengua: 'Español', fondoEstatal: 'Fondo de Preservación', director: 'Francisco J. Lombardi', productionCompany: 'Inca Films', duration: 116, presupuestoAprobado: 1200000, localPath: M('LA BOCA DEL LOBO.mp4'), overview: 'Un destacamento militar llega a un pueblo andino durante el conflicto armado interno.', estadoPublicacion: 'Aprobado' },
    { title: 'Días de Santiago', anio: 2004, region: 'Costa', lengua: 'Español', fondoEstatal: 'Fondo Cultural Regional', director: 'Josué Méndez', productionCompany: 'Chullachaki Producciones', duration: 83, presupuestoAprobado: 900000, localPath: M('DIAS DE SANTIAGO.mp4'), overview: 'Un exmarine intenta reintegrarse a la vida civil en Lima tras combatir.', estadoPublicacion: 'Aprobado' },
    { title: 'Alias la Gringa', anio: 1991, region: 'Costa', lengua: 'Español', fondoEstatal: 'Fondo de Preservación', director: 'Alberto Durant', productionCompany: 'Kusi Films', duration: 100, presupuestoAprobado: 1100000, localPath: M('ALIAS LA GRINGA.mp4'), overview: 'Un célebre fugitivo se mueve entre la prisión y la calle en el Perú de los años 90.', estadoPublicacion: 'Aprobado' },
    { title: 'Bajo la Piel', anio: 1996, region: 'Costa', lengua: 'Español', fondoEstatal: 'Fondo Histórico Nacional', director: 'Francisco J. Lombardi', productionCompany: 'Inca Films', duration: 105, presupuestoAprobado: 1500000, localPath: M('BAJO LA PIEL.mp4'), overview: 'Un comisario investiga una serie de crímenes rituales en una ciudad del norte.', estadoPublicacion: 'Aprobado' },
    { title: 'Túpac Amaru', anio: 1984, region: 'Sierra', lengua: 'Español', fondoEstatal: 'Fondo Histórico Nacional', director: 'Federico García Hurtado', productionCompany: 'Kayto Films', duration: 105, presupuestoAprobado: 800000, localPath: M('Túpac Amaru.mp4'), overview: 'La rebelión de José Gabriel Condorcanqui contra el dominio colonial español.', estadoPublicacion: 'Aprobado' },
    { title: '¡Asu Mare! 2', anio: 2015, region: 'Costa', lengua: 'Español', fondoEstatal: 'No Aplica', director: 'Ricardo Maldonado', productionCompany: 'Tondero Films', duration: 112, presupuestoAprobado: 2000000, localPath: M('¡Asu mare! 2 (2015)1080p.mp4'), overview: 'La continuación de la historia de Carlos Alcántara, del ascenso a la fama al amor.', estadoPublicacion: 'Aprobado' },
    { title: '¡Asu Mare! 4: Los Amigos', anio: 2023, region: 'Costa', lengua: 'Español', fondoEstatal: 'No Aplica', director: 'Jorge Ulloa', productionCompany: 'Tondero Films', duration: 100, presupuestoAprobado: 2500000, localPath: M('!Asu Mare! 4 Los Amigos🇵🇪.mp4'), overview: 'Cachín reúne a sus amigos de siempre en una nueva aventura.', estadoPublicacion: 'Aprobado' },
    { title: 'Asu Mare (Registro IA)', anio: 2013, region: 'Costa', lengua: 'Español', fondoEstatal: 'No Aplica', director: 'Ricardo Maldonado', productionCompany: 'Tondero Films', duration: 95, presupuestoAprobado: 1800000, localPath: M('ASUMARE.ia.mp4'), overview: 'Registro digitalizado del fenómeno de taquilla peruano.', estadoPublicacion: 'Pendiente' },
    { title: 'Caiga Quien Caiga', anio: 2018, region: 'Costa', lengua: 'Español', fondoEstatal: 'Fondo Cultural Regional', director: 'Producción Independiente', productionCompany: 'Archivo Regional', duration: 90, presupuestoAprobado: 600000, localPath: M('CAIGA  QUIEN  CAIGA  COMPLETA   PELICULA PERUANA(360P).mp4'), overview: 'Comedia peruana de circulación popular, en resguardo por su valor documental.', estadoPublicacion: 'Aprobado', fechaVencimientoDerechos: new Date(Date.now() - 3 * 86400000) },
];

const USUARIOS = [
    { username: 'adrian', email: 'adrian23erick@gmail.com', password: 'contraseña', role: 'user', region: 'Lima' },
    { username: 'Dr. Elena Vargas', email: 'elena.vargas@gmail.com', password: 'investiga123', role: 'user', region: 'Cusco', institution: 'Instituto Nacional de Cultura' },
    { username: 'tecnico', email: 'tecnico@gmail.com', password: 'tecnico123', role: 'tecnico', region: 'Arequipa', institution: 'Archivo Regional Sur' },
    { username: 'SuperAdmin', email: 'admin@arcast.com', password: 'admin123', role: 'admin', region: 'Lima' },
    { username: 'jefe', email: 'jefe@gmail.com', password: 'contraseña', role: 'admin', region: 'Lima' },
];

// Reparto de reproducciones por departamento (peso relativo).
const PESO_REGIONES = {
    Lima: 90, Cusco: 55, Arequipa: 35, 'La Libertad': 28, Loreto: 22, Puno: 24,
    Piura: 18, Áncash: 15, Junín: 14, Lambayeque: 12, Ica: 10, Cajamarca: 9, Ucayali: 8, Tacna: 7,
};

async function seedInstitucional({ log = console.log } = {}) {
    // 1) Usuarios (upsert por email, con región y consentimiento).
    for (const u of USUARIOS) {
        const existing = await User.findOne({ email: u.email });
        if (existing) {
            existing.role = u.role; existing.region = u.region;
            if (u.institution) existing.institution = u.institution;
            existing.consentPII = true; existing.consentPIIAt = existing.consentPIIAt || new Date();
            await existing.save();
        } else {
            await User.create({ ...u, consentPII: true, consentPIIAt: new Date() });
        }
    }
    log(`[seed-inst] Usuarios asegurados: ${USUARIOS.length}`);

    // 2) Películas (upsert por título).
    const movieIds = [];
    for (const p of PELICULAS) {
        const doc = await Movie.findOneAndUpdate(
            { title: p.title },
            {
                $set: {
                    ...p,
                    releaseDate: `${p.anio}-01-01`,
                    visible: !p.fechaVencimientoDerechos || p.fechaVencimientoDerechos > new Date(),
                    createdBy: 'seed', tmdbId: p.tmdbId || `seed-${p.title.replace(/\s+/g, '-').toLowerCase()}`,
                },
            },
            { upsert: true, new: true },
        );
        movieIds.push(doc._id);
    }
    log(`[seed-inst] Películas catalogadas: ${PELICULAS.length}`);

    // 3) Reproducciones georreferenciadas (sólo si aún no hay volumen).
    const existingPlays = await PlaybackLog.countDocuments();
    if (existingPlays < 100) {
        const investigador = await User.findOne({ email: 'adrian23erick@gmail.com' });
        const bag = [];
        Object.entries(PESO_REGIONES).forEach(([region, peso]) => {
            for (let i = 0; i < peso; i++) bag.push(region);
        });
        const docs = [];
        for (let i = 0; i < 300; i++) {
            const region = bag[Math.floor(Math.random() * bag.length)];
            const contentId = movieIds[Math.floor(Math.random() * movieIds.length)];
            const daysAgo = Math.floor(Math.random() * 30);
            docs.push({
                userId: investigador?._id || movieIds[0],
                contentId: String(contentId),
                contentType: 'Movie',
                durationMinutes: 20 + Math.floor(Math.random() * 80),
                region,
                timestamp: new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000)),
            });
        }
        await PlaybackLog.insertMany(docs);
        log(`[seed-inst] Reproducciones georreferenciadas generadas: ${docs.length}`);
    } else {
        log(`[seed-inst] Reproducciones ya presentes (${existingPlays}); no se regeneran.`);
    }

    // 4) Anotaciones + citas de ejemplo (idempotente por dedupe simple).
    const elena = await User.findOne({ email: 'elena.vargas@gmail.com' });
    if (elena && movieIds.length) {
        const already = await Annotation.countDocuments({ userId: elena._id });
        if (already === 0) {
            await Annotation.create([
                { userId: elena._id, contentId: String(movieIds[1]), contentType: 'Movie', timestampSeconds: 625, text: 'Nota sobre la importancia del registro etnográfico en la representación andina; el encuadre sugiere intención documental.' },
                { userId: elena._id, contentId: String(movieIds[2]), contentType: 'Movie', timestampSeconds: 945, text: 'Relevante para el proyecto de memoria histórica. Se observa distorsión en el canal de audio izquierdo a partir de este punto.' },
            ]);
            await Citation.create([
                { userId: elena._id, contentId: String(movieIds[1]), contentTitle: 'La Teta Asustada', format: 'APA', reference: 'Llosa, C. (Director). (2009). La Teta Asustada [Película]. Oberón Cinematográfica.', project: 'Proyecto Memoria Viva' },
                { userId: elena._id, contentId: String(movieIds[2]), contentTitle: 'La Boca del Lobo', format: 'Chicago', reference: 'Lombardi, Francisco J. La Boca del Lobo. Inca Films, 1988.', project: 'Investigación Regional' },
            ]);
            log('[seed-inst] Anotaciones y citas de ejemplo creadas para Dr. Elena Vargas.');
        }
    }

    log('[seed-inst] Seed institucional completo.');
    return { movies: PELICULAS.length, users: USUARIOS.length };
}

module.exports = { seedInstitucional };

if (require.main === module) {
    (async () => {
        if (!process.env.MONGO_URI) { console.error('Falta MONGO_URI'); process.exit(1); }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB. Sembrando datos institucionales...');
        await seedInstitucional({});
        await mongoose.disconnect();
        process.exit(0);
    })().catch((e) => { console.error('Error en seed:', e.message); process.exit(1); });
}
