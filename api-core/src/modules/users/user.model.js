const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, DEPARTAMENTOS } = require("../../common/catalogs");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor, ingresa un correo válido']
  },
  password: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  role: {
    type: String,
    enum: ROLES, // ["user", "tecnico", "admin"]
    default: "user",
  },

  // --- Datos demográficos institucionales (analítica territorial de la Vista Jefe) ---
  // Departamento de procedencia. Obligatorio en el registro nuevo (se valida en el
  // controlador); opcional a nivel de esquema para no romper cuentas ya existentes.
  region: { type: String, enum: [...DEPARTAMENTOS, null], default: null },
  institution: { type: String },        // Entidad a la que pertenece el investigador.

  // --- Protección de datos personales (Ley N° 29733) ---
  // Base legal / consentimiento explícito para tratar los datos demográficos.
  consentPII: { type: Boolean, default: false },
  consentPIIAt: { type: Date },

  // --- Borrado lógico (nunca hard-delete en software del Estado) ---
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  watchlist: [
    {
      item: { type: Schema.Types.ObjectId, required: true },
      kind: { type: String, enum: ["Movie", "TVShow"] },
    },
  ],
  watchHistory: [
    {
      contentId: String,
      contentType: { type: String, enum: ["Movie", "TVShow"] }, // Rescatado de tu compañero
      percentWatched: Number,
      currentTime: Number,
      lastTimeWatched: { type: Date, default: Date.now },
    },
  ],
  lastTimeWatched: { type: Date, default: Date.now },
}, { timestamps: true }); // createdAt / updatedAt para trazabilidad de cuentas

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model("User", UserSchema);
