/**
 * link-local-videos.js
 *
 * Escanea la carpeta ./media (montada en Docker como /media) y vincula
 * automáticamente cada archivo de video a la película o serie más similar
 * en la base de datos usando coincidencia de nombre.
 *
 * Uso:
 *   node link-local-videos.js              # modo dry-run (solo muestra matches)
 *   node link-local-videos.js --apply      # aplica los cambios a la BD
 *   node link-local-videos.js --dir /ruta  # escanea otra carpeta
 */
require('dotenv').config();
const fs        = require('fs');
const path      = require('path');
const mongoose  = require('mongoose');
const Movie     = require('./src/modules/catalog/movie.model');
const TVShow    = require('./src/modules/catalog/tvshow.model');

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov']);

// --- args ---
const args     = process.argv.slice(2);
const apply    = args.includes('--apply');
const dirArg   = args.find(a => a.startsWith('--dir='));
const SCAN_DIR = dirArg ? dirArg.split('=')[1] : path.join(__dirname, '..', 'media');
const CONTAINER_PREFIX = '/media'; // cómo ve Docker esa misma carpeta

// Normaliza un nombre para comparar: minúsculas, sin año, sin símbolos
function normalize(str) {
    return String(str)
        .toLowerCase()
        .replace(/\s*\(\d{4}\)\s*/g, '')   // quita (2020)
        .replace(/\s*\[\d{4}\]\s*/g, '')   // quita [2020]
        .replace(/[^a-z0-9\s]/gi, ' ')     // símbolos → espacio
        .replace(/\s+/g, ' ')
        .trim();
}

// Similitud simple: cuántas palabras del título están en el nombre del archivo
function score(titleNorm, fileNorm) {
    const words = titleNorm.split(' ').filter(w => w.length > 2);
    if (!words.length) return 0;
    const hits = words.filter(w => fileNorm.includes(w)).length;
    return hits / words.length;
}

async function main() {
    if (!fs.existsSync(SCAN_DIR)) {
        console.error(`Carpeta no encontrada: ${SCAN_DIR}`);
        console.error('Coloca tus videos en ./media/ (junto a docker-compose.yml)');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ReelScoreDB');
    console.log('Conectado a MongoDB\n');

    // Cargar catálogo
    const [movies, tvshows] = await Promise.all([
        Movie.find().select('title localPath tmdbId').lean(),
        TVShow.find().select('name localPath tmdbId').lean(),
    ]);

    const catalog = [
        ...movies.map(m  => ({ ...m, _type: 'Movie',  label: m.title })),
        ...tvshows.map(t => ({ ...t, _type: 'TVShow', label: t.name  })),
    ];

    // Escanear archivos de video
    const files = fs.readdirSync(SCAN_DIR)
        .filter(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
        .map(f => ({
            file: f,
            norm: normalize(path.parse(f).name),
            containerPath: `${CONTAINER_PREFIX}/${f}`,
            absPath: path.join(SCAN_DIR, f),
        }));

    if (!files.length) {
        console.log(`No se encontraron videos en ${SCAN_DIR}`);
        console.log('Copia tus archivos .mp4 / .mkv a esa carpeta e intenta de nuevo.');
        await mongoose.disconnect();
        return;
    }

    console.log(`Encontrados ${files.length} archivo(s) de video en ${SCAN_DIR}\n`);

    const results = [];

    for (const f of files) {
        let best = null, bestScore = 0;

        for (const entry of catalog) {
            const s = score(normalize(entry.label), f.norm);
            if (s > bestScore) { bestScore = s; best = entry; }
        }

        const alreadySet = best && best.localPath === f.containerPath;
        results.push({ file: f.file, containerPath: f.containerPath, match: best, score: bestScore, alreadySet });
    }

    // Mostrar resultados
    console.log('─'.repeat(70));
    for (const r of results) {
        if (!r.match || r.score < 0.4) {
            console.log(`⚠  ${r.file}`);
            console.log(`   Sin match confiable (score ${(r.score * 100).toFixed(0)}%)\n`);
            continue;
        }
        const tag = r.alreadySet ? '✅ ya vinculado' : apply ? '🔗 vinculando...' : '🔗 match (--apply para vincular)';
        console.log(`${tag}`);
        console.log(`   Archivo : ${r.file}`);
        console.log(`   BD      : ${r.match._type} — "${r.match.label}" (score ${(r.score * 100).toFixed(0)}%)`);
        console.log(`   Path    : ${r.containerPath}\n`);
    }
    console.log('─'.repeat(70));

    if (!apply) {
        console.log('\nModo DRY-RUN. Ejecuta con --apply para guardar en la BD.\n');
        await mongoose.disconnect();
        return;
    }

    // Aplicar cambios
    let updated = 0;
    for (const r of results) {
        if (!r.match || r.score < 0.4 || r.alreadySet) continue;
        const Model = r.match._type === 'Movie' ? Movie : TVShow;
        await Model.updateOne({ _id: r.match._id }, { localPath: r.containerPath });
        updated++;
    }

    console.log(`\n✅ ${updated} película(s)/serie(s) vinculadas en la BD.\n`);
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
