const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        // Mostramos a qué host nos conectamos (sin credenciales) para evitar confusiones.
        const host = (process.env.MONGO_URI || '').replace(/\/\/.*@/, '//');
        console.log(`MongoDB conectado -> ${host}`);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;