const Citation = require('./citation.model');
/** @type {any} */
const Movie = require('../catalog/movie.model');
const { buildReference } = require('./citations.service');
const audit = require('../../common/audit.service');
const { catchAsync, AppError } = require('../../common/error.utils');

// Genera la referencia (APA/Chicago) a partir de la ficha real y la guarda en el
// historial de "Citas Exportadas" del investigador.
exports.generateCitation = catchAsync(async (req, res, next) => {
  const { contentId, format = 'APA', project } = req.body;
  if (!contentId) return next(new AppError('Falta el contenido a citar.', 400));

  const movie = await Movie.findById(contentId).lean();
  if (!movie) return next(new AppError('Contenido no encontrado.', 404));

  const reference = buildReference(movie, format === 'Chicago' ? 'Chicago' : 'APA');

  const citation = await Citation.create({
    userId: req.user.id,
    contentId,
    contentTitle: movie.title || movie.name,
    format: format === 'Chicago' ? 'Chicago' : 'APA',
    reference,
    project: project || null,
  });

  await audit.recordMutation(req.user.id, 'CITATION_EXPORT', {
    contentId, format: citation.format,
  }, { ip: req.ip, username: req.user.username, role: req.user.role });

  res.status(201).json(citation);
});

// Lista las citas exportadas del usuario autenticado (para el perfil).
exports.getMyCitations = catchAsync(async (req, res, _next) => {
  const citations = await Citation.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .lean();
  res.json(citations);
});

exports.deleteCitation = catchAsync(async (req, res, next) => {
  const citation = await Citation.findById(req.params.id);
  if (!citation) return next(new AppError('Cita no encontrada.', 404));
  if (String(citation.userId) !== String(req.user.id)) {
    return next(new AppError('No puedes borrar una cita que no es tuya.', 403));
  }
  await citation.deleteOne();
  res.json({ message: 'Cita eliminada.' });
});
