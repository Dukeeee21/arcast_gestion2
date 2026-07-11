/**
 * Seed de usuarios para la base LOCAL.
 *
 * Crea las cuentas base (con sus roles) para poder entrar a la app cuando la
 * base de datos está vacía. Es idempotente: si un usuario ya existe, actualiza
 * su rol pero no lo duplica.
 *
 * Uso (con Docker corriendo):
 *   docker-compose exec api-core node seed-users.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

/** @type {any} */
const User = require('./src/modules/users/user.model');

// Puedes editar libremente esta lista (usuario, email, contraseña, rol).
const USERS = [
    { username: 'SuperAdmin', email: 'admin@arcast.com',        password: 'admin123',   role: 'admin' },
    { username: 'jefe',       email: 'jefe@gmail.com',          password: 'contraseña', role: 'admin'  },
    { username: 'adrian',     email: 'adrian23erick@gmail.com', password: 'contraseña', role: 'user'  },
];

async function run() {
    if (!process.env.MONGO_URI) {
        console.error('Falta MONGO_URI en el entorno.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB. Sembrando usuarios...');

    for (const u of USERS) {
        const existing = await User.findOne({ email: u.email });
        if (existing) {
            existing.role = u.role;
            await existing.save(); // no re-hashea el password (no se modificó)
            console.log(`= Actualizado (rol=${u.role}): ${u.email}`);
        } else {
            // new User().save() dispara el hook pre-save que hashea la contraseña.
            await User.create(u);
            console.log(`+ Creado (${u.role}): ${u.email}  [pass: ${u.password}]`);
        }
    }

    console.log('\nListo. Ya puedes iniciar sesión con esas cuentas.');
    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error('Error sembrando usuarios:', err.message);
    process.exit(1);
});
