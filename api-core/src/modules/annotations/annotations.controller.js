const Annotation = require('./annotation.model');
const { catchAsync, AppError } = require('../../common/error.utils');

// Lista TODAS las anotaciones del usuario (para el workspace personal).
exports.getAllMine = catchAsync(async (req, res, _next) => {
  const notes = await Annotation.find({ userId: req.user.id })
    .sort({ createdAt: -1 }).limit(200).lean();
  res.json(notes);
});

// Lista las anotaciones del usuario autenticado para un contenido, ordenadas
// cronológicamente por su marca de tiempo dentro del video.
exports.getMyAnnotations = catchAsync(async (req, res, _next) => {
  const notes = await Annotation.find({
    userId: req.user.id,
    contentId: req.params.contentId,
  }).sort({ timestampSeconds: 1 }).lean();
  res.json(notes);
});

// Crea una anotación anclada al segundo exacto del reproductor.
exports.createAnnotation = catchAsync(async (req, res, next) => {
  const { contentId, contentType, timestampSeconds, text } = req.body;
  if (!contentId || text === undefined || text.trim() === '') {
    return next(new AppError('La nota y el contenido son obligatorios.', 400));
  }
  if (timestampSeconds === undefined || Number(timestampSeconds) < 0) {
    return next(new AppError('La marca de tiempo no es válida.', 400));
  }

  const note = await Annotation.create({
    userId: req.user.id,
    contentId,
    contentType: contentType === 'TVShow' ? 'TVShow' : 'Movie',
    timestampSeconds: Math.floor(Number(timestampSeconds)),
    text: text.trim(),
  });
  res.status(201).json(note);
});

// Edita una anotación propia (solo el dueño).
exports.updateAnnotation = catchAsync(async (req, res, next) => {
  const note = await Annotation.findById(req.params.id);
  if (!note) return next(new AppError('Anotación no encontrada.', 404));
  if (String(note.userId) !== String(req.user.id)) {
    return next(new AppError('No puedes editar una nota que no es tuya.', 403));
  }
  if (req.body.text !== undefined) note.text = String(req.body.text).trim();
  if (req.body.timestampSeconds !== undefined) {
    note.timestampSeconds = Math.max(0, Math.floor(Number(req.body.timestampSeconds)));
  }
  await note.save();
  res.json(note);
});

// Elimina una anotación propia (solo el dueño).
exports.deleteAnnotation = catchAsync(async (req, res, next) => {
  const note = await Annotation.findById(req.params.id);
  if (!note) return next(new AppError('Anotación no encontrada.', 404));
  if (String(note.userId) !== String(req.user.id)) {
    return next(new AppError('No puedes borrar una nota que no es tuya.', 403));
  }
  await note.deleteOne();
  res.json({ message: 'Anotación eliminada.' });
});
