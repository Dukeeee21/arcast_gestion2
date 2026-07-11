const mongoose = require("mongoose");
const {
  REGIONES_NATURALES,
  LENGUAS,
  FONDOS_ESTATALES,
  ESTADOS_PUBLICACION,
} = require("../../common/catalogs");
const Schema = mongoose.Schema;

// Documento adjunto (guion, contrato, resolución, reporte de restauración...).
// Una película ya no es "un archivo": es un expediente que agrupa el video y N PDFs.
const AttachmentSchema = new Schema({
  label: { type: String, required: true },        // Ej: "Guion", "Contrato de Distribución"
  fileName: { type: String, required: true },     // Nombre original del PDF
  storagePath: { type: String, required: true },  // Ruta en el almacenamiento del servidor
  mimeType: { type: String, default: 'application/pdf' },
  sizeBytes: { type: Number },
  uploadedBy: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const MovieSchema = new Schema({
  title: { type: String, required: true },
  overview: { type: String },
  posterUrl: { type: String },
  backdropUrl: { type: String },
  tmdbId: { type: String }, // LIBERADO: Ya no es obligatorio para el contenido local
  releaseDate: { type: String },
  genres: [{ type: String }],
  trailerKey: { type: String },
  voteAverage: { type: Number },
  duration: { type: Number },
  languages: [{ type: String }],
  originCountry: [{ type: String }],

  // ================= FICHA TÉCNICA INSTITUCIONAL (metadatos del Estado) =================
  // Se catalogan con valores controlados (ver src/common/catalogs.js) para que los
  // filtros del investigador y los reportes del Jefe sean consistentes.
  // NOTA: a nivel de esquema llevan `default` para no romper el contenido importado
  // de TMDB; la OBLIGATORIEDAD real se exige en el formulario del técnico/admin.
  region: { type: String, enum: REGIONES_NATURALES, default: undefined },
  lengua: { type: String, enum: LENGUAS, default: undefined },
  fondoEstatal: { type: String, enum: FONDOS_ESTATALES, default: 'No Aplica' },
  anio: { type: Number }, // Año de catalogación/producción (numérico, para filtrar por rango).
  director: { type: String },           // Para citas APA/Chicago fieles.
  productionCompany: { type: String },  // Casa productora / entidad responsable.

  // ================= GESTIÓN FINANCIERA (Retorno Estatal, Vista Jefe) =================
  presupuestoAprobado: { type: Number, default: 0 }, // En PEN. Cruza con nº de vistas.

  // ================= VIGENCIA / DERECHOS (DRM, Vista Admin) =================
  fechaVencimientoDerechos: { type: Date, default: null },
  // `visible` lo apaga automáticamente el cron cuando expira el contrato.
  visible: { type: Boolean, default: true },

  // ================= FLUJO DE APROBACIÓN =================
  // Default 'Aprobado': todo lo importado/sembrado (TMDB, archive.org) y el
  // contenido histórico queda publicado como hasta ahora. El formulario del
  // técnico (Fase 3) crea el registro con 'Borrador' y lo eleva a 'Pendiente'
  // con "Enviar a revisión"; solo un supervisor lo pasa a 'Aprobado'.
  estadoPublicacion: { type: String, enum: ESTADOS_PUBLICACION, default: 'Aprobado' },

  // ================= DOCUMENTOS ADJUNTOS (expediente) =================
  attachments: { type: [AttachmentSchema], default: [] },

  // ================= TRAZABILIDAD / BORRADO LÓGICO =================
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  approvedBy: { type: String, default: null },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },

  // Array de plataformas
  platforms: [
    {
      name: String,
      logo: String,
      link: String,
    },
  ],

  watchLink: { type: String },

  // Ruta absoluta al archivo de video almacenado localmente (streaming RF11)
  localPath: { type: String },

  // Clave del objeto en Cloudflare R2 (despliegue público, sin depender del
  // disco local del servidor). Si existe, el streaming la prioriza sobre
  // `localPath` y redirige a una URL firmada temporal.
  r2Key: { type: String, default: null },

  // Búsqueda semántica: vector de embedding del título+sinopsis y el texto con
  // el que se generó (para detectar cambios). `select: false` para no arrastrar
  // el vector en las consultas normales del catálogo.
  embedding: { type: [Number], default: undefined, select: false },
  embeddingText: { type: String, select: false },
}, { timestamps: true }); // createdAt / updatedAt del expediente

// Índices para los filtros del investigador y las agregaciones del Jefe.
MovieSchema.index({ region: 1, lengua: 1, fondoEstatal: 1, anio: 1 });
MovieSchema.index({ estadoPublicacion: 1, visible: 1, deletedAt: 1 });

module.exports = mongoose.model("Movie", MovieSchema);
