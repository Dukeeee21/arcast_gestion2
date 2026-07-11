/**
 * set-watch-link.js  <título>  <URL>
 * Asigna un watchLink a una película por título (búsqueda parcial).
 * Ejemplo:
 *   node set-watch-link.js "Esta Estable" "https://www.retinalatina.org/peliculas/esta-estable/"
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Movie  = require('./src/modules/catalog/movie.model');
const TVShow = require('./src/modules/catalog/tvshow.model');

const [,, titleArg, urlArg] = process.argv;
if (!titleArg || !urlArg) {
    console.error('Uso: node set-watch-link.js "<título>" "<url>"');
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const regex = new RegExp(titleArg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let doc = await Movie.findOne({ title: regex });
    let col = 'Movie';
    if (!doc) { doc = await TVShow.findOne({ name: regex }); col = 'TVShow'; }

    if (!doc) {
        console.log(`No encontrado: "${titleArg}"`);
    } else {
        await (col === 'Movie' ? Movie : TVShow).updateOne({ _id: doc._id }, { watchLink: urlArg });
        console.log(`✅ Actualizado [${col}]: "${doc.title || doc.name}"`);
        console.log(`   watchLink → ${urlArg}`);
    }
    mongoose.disconnect();
});
