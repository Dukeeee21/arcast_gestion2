const path = require("path");
const fs = require("fs");
const moviesService = require("./movies.service");
const tmdbProvider = require("./providers/tmdb.provider");
const audit = require("../../common/audit.service");
const { catchAsync, AppError } = require("../../common/error.utils");

// Contexto del actor para la bitácora de auditoría (quién, desde dónde).
const actor = (req) => ({ ip: req.ip, username: req.user?.username, role: req.user?.role });

// Raíz permitida para servir adjuntos. Todo PDF debe vivir bajo /media para que
// una ruta manipulada no pueda salirse a otras partes del sistema de archivos.
const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT || "/media");

// Permite recibir un filtro como valor único o como lista separada por comas
// (checkboxes de selección múltiple): "Costa,Sierra" -> { $in: ['Costa','Sierra'] }.
const multi = (value) => {
  if (!value) return undefined;
  const list = String(value).split(",").map((v) => v.trim()).filter(Boolean);
  if (list.length === 0) return undefined;
  return list.length === 1 ? list[0] : { $in: list };
};

exports.getAllMovies = catchAsync(async (req, res, _next) => {
  const { genre, platform, sort, search, region, lengua, fondo, anioMin, anioMax } = req.query;
  let query = {};

  if (search) query.title = { $regex: search, $options: "i" };
  if (genre && genre !== "Todas") query.genres = genre;
  if (platform && platform !== "Todas")
    query["platforms.name"] = { $regex: platform, $options: "i" };

  // --- Filtros de metadatos institucionales (panel del investigador) ---
  const regionFilter = multi(region);
  if (regionFilter) query.region = regionFilter;
  const lenguaFilter = multi(lengua);
  if (lenguaFilter) query.lengua = lenguaFilter;
  const fondoFilter = multi(fondo);
  if (fondoFilter) query.fondoEstatal = fondoFilter;

  // Rango de años (numérico, sobre el campo `anio`).
  const min = parseInt(anioMin, 10);
  const max = parseInt(anioMax, 10);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    query.anio = {};
    if (!Number.isNaN(min)) query.anio.$gte = min;
    if (!Number.isNaN(max)) query.anio.$lte = max;
  }

  // --- Visibilidad del catálogo público ---
  // Ocultamos lo borrado lógicamente, lo apagado por vencimiento de derechos
  // (DRM) y lo que no está Aprobado (borradores/pendientes/rechazados sólo se
  // ven en Administración/Supervisión). `$ne` matchea también los documentos
  // donde el campo aún no existe (contenido heredado).
  query.deletedAt = null;
  query.visible = { $ne: false };
  query.estadoPublicacion = { $in: ['Aprobado', null] };

  const movies = await moviesService.findAll(
    query,
    String(sort || ""),
    String(search || ""),
  );
  res.json(movies);
});

exports.getMovieById = catchAsync(async (req, res, _next) => {
  let movie = null;

  if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    movie = await moviesService.findById(req.params.id);
  }

  if (!movie) {
    movie = await tmdbProvider.getMovieDetails(req.params.id);
  }

  if (!movie) throw new AppError("Película no encontrada", 404);
  res.json(movie);
});

exports.createMovie = catchAsync(async (req, res, next) => {
  // Validaciones del RF16
  if (!req.body.title || req.body.title.trim() === "") {
    return next(new AppError("El título de la película es obligatorio.", 400));
  }
  if (req.body.duration !== undefined && req.body.duration < 0) {
    return next(
      new AppError("La duración de la película no puede ser negativa.", 400),
    );
  }

  if (!req.body.tmdbId) {
    req.body.tmdbId = "manual-" + Date.now();
  }

  // Trazabilidad y flujo de aprobación: el técnico solo crea BORRADORES; un
  // supervisor (admin) o el jefe pueden publicar directo.
  req.body.createdBy = req.user.username;
  if (req.user.role === "tecnico") {
    req.body.estadoPublicacion = "Borrador";
  }

  const savedMovie = await moviesService.create(req.body);
  await audit.recordMutation(
    req.user.id, "MOVIE_CREATE",
    { movieId: savedMovie._id, title: savedMovie.title, estado: savedMovie.estadoPublicacion },
    actor(req),
  );
  res.status(201).json(savedMovie);
});

exports.updateMovie = catchAsync(async (req, res, next) => {
  // Validaciones del RF16
  if (req.body.title !== undefined && req.body.title.trim() === "") {
    return next(
      new AppError("El título de la película no puede estar vacío.", 400),
    );
  }
  if (req.body.duration !== undefined && req.body.duration < 0) {
    return next(
      new AppError("La duración de la película no puede ser negativa.", 400),
    );
  }

  req.body.updatedBy = req.user.username;
  const movie = await moviesService.update(req.params.id, req.body);
  if (!movie) throw new AppError("Película no encontrada", 404);

  await audit.recordMutation(
    req.user.id, "MOVIE_UPDATE",
    { movieId: movie._id, title: movie.title },
    actor(req),
  );
  res.json(movie);
});

exports.deleteMovie = catchAsync(async (req, res, next) => {
  // Borrado LÓGICO: en software del Estado nunca se destruye la evidencia.
  const movie = await moviesService.softDelete(req.params.id, req.user.username);
  if (!movie) return next(new AppError("Película no encontrada", 404));

  await audit.recordMutation(
    req.user.id, "MOVIE_DELETE",
    { movieId: movie._id, title: movie.title },
    { ...actor(req), severity: "WARN" },
  );
  res.json({ message: "Película archivada (borrado lógico) exitosamente" });
});

// --- FLUJO DE APROBACIÓN (técnico → supervisor) ---

// El técnico eleva su borrador a revisión.
exports.submitForReview = catchAsync(async (req, res, next) => {
  const movie = await moviesService.update(req.params.id, {
    estadoPublicacion: "Pendiente",
    updatedBy: req.user.username,
  });
  if (!movie) return next(new AppError("Película no encontrada", 404));
  await audit.recordMutation(
    req.user.id, "MOVIE_SUBMIT_REVIEW",
    { movieId: movie._id, title: movie.title },
    actor(req),
  );
  res.json(movie);
});

// El supervisor aprueba: la obra se hace visible en la plataforma.
exports.approveMovie = catchAsync(async (req, res, next) => {
  const movie = await moviesService.update(req.params.id, {
    estadoPublicacion: "Aprobado",
    approvedBy: req.user.username,
    visible: true,
  });
  if (!movie) return next(new AppError("Película no encontrada", 404));
  await audit.recordMutation(
    req.user.id, "MOVIE_APPROVE",
    { movieId: movie._id, title: movie.title },
    { ...actor(req), severity: "CRITICAL" },
  );
  res.json(movie);
});

// El supervisor rechaza y devuelve al técnico con un motivo.
exports.rejectMovie = catchAsync(async (req, res, next) => {
  const movie = await moviesService.update(req.params.id, {
    estadoPublicacion: "Rechazado",
    updatedBy: req.user.username,
  });
  if (!movie) return next(new AppError("Película no encontrada", 404));
  await audit.recordMutation(
    req.user.id, "MOVIE_REJECT",
    { movieId: movie._id, title: movie.title, motivo: req.body.motivo || "" },
    { ...actor(req), severity: "WARN" },
  );
  res.json(movie);
});

// Listado de GESTIÓN (admin/técnico/jefe): incluye borradores, pendientes y
// ocultos — todo lo NO borrado — para poder administrar el ciclo de vida.
exports.getManagedMovies = catchAsync(async (req, res, _next) => {
  const filter = { deletedAt: null };
  if (req.query.estado) filter.estadoPublicacion = req.query.estado;
  const movies = await moviesService.findManaged(filter);
  res.json(movies);
});

// Descarga un documento adjunto (guion, contrato, resolución...) del expediente.
exports.downloadAttachment = catchAsync(async (req, res, next) => {
  const movie = await moviesService.findById(req.params.id);
  if (!movie) throw new AppError("Película no encontrada", 404);

  const attachment = (movie.attachments || []).find(
    (a) => String(a._id) === req.params.attId,
  );
  if (!attachment) throw new AppError("Documento no encontrado", 404);

  // Blindaje contra path traversal: el archivo resuelto debe quedar dentro de MEDIA_ROOT.
  const resolved = path.resolve(attachment.storagePath);
  if (resolved !== MEDIA_ROOT && !resolved.startsWith(MEDIA_ROOT + path.sep)) {
    return next(new AppError("Ruta de documento no permitida.", 403));
  }
  if (!fs.existsSync(resolved)) {
    return next(new AppError("El archivo ya no está disponible en el servidor.", 404));
  }

  res.setHeader("Content-Type", attachment.mimeType || "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(attachment.fileName || "documento.pdf")}"`,
  );
  fs.createReadStream(resolved).pipe(res);
});

exports.exploreMovies = catchAsync(async (req, res, _next) => {
  const { genre, sort, search, page = 1 } = req.query;
  const { results, totalPages } = await tmdbProvider.explorePeruvianMovies(
    Number(page),
    { genre, sort, search },
  );

  const detailedResults = await Promise.all(
    results.map((m) => tmdbProvider.getMovieDetails(m.id)),
  );

  const movies = detailedResults
    .filter(
      (m) => m.productionCountries && m.productionCountries.includes("PE"),
    )
    .filter((m) => m.posterUrl);

  res.json({ results: movies, totalPages, page: Number(page) });
});
