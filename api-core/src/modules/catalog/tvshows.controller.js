const tvshowsService = require("./tvshows.service");
const { catchAsync, AppError } = require("../../common/error.utils");

exports.getAllTVShows = catchAsync(async (req, res, _next) => {
  const { genre, platform, sort, search } = req.query;
  let query = {};

  if (search) query.name = { $regex: search, $options: "i" };
  if (genre && genre !== "Todas") query.genres = genre;
  if (platform && platform !== "Todas")
    query["platforms.name"] = { $regex: platform, $options: "i" };

  let shows;

  if (!sort && !search) {
    shows = await tvshowsService.findAll(query, { _id: -1 });
    shows = shows.sort(() => Math.random() - 0.5);
  } else {
    let sortOption = { _id: -1 };
    if (sort === "rating") sortOption = { voteAverage: -1 };
    if (sort === "newest") sortOption = { firstAirDate: -1 };

    shows = await tvshowsService.findAll(query, sortOption);
  }

  res.json(shows);
});

exports.getTVShowById = catchAsync(async (req, res, _next) => {
  const show = await tvshowsService.findById(req.params.id);
  if (!show) throw new AppError("Serie no encontrada", 404);
  res.json(show);
});

exports.createTVShow = catchAsync(async (req, res, next) => {
  // Validaciones del RF16
  if (!req.body.name || req.body.name.trim() === "") {
    return next(new AppError("El nombre de la serie es obligatorio.", 400));
  }
  if (req.body.seasons !== undefined && req.body.seasons < 0) {
    return next(
      new AppError("El número de temporadas no puede ser negativo.", 400),
    );
  }

  if (!req.body.tmdbId) {
    req.body.tmdbId = "manual-" + Date.now();
  }
  const show = await tvshowsService.create(req.body);
  res.status(201).json(show);
});

exports.updateTVShow = catchAsync(async (req, res, next) => {
  // Validaciones del RF16
  if (req.body.name !== undefined && req.body.name.trim() === "") {
    return next(
      new AppError("El nombre de la serie no puede estar vacío.", 400),
    );
  }
  if (req.body.seasons !== undefined && req.body.seasons < 0) {
    return next(
      new AppError("El número de temporadas no puede ser negativo.", 400),
    );
  }

  const show = await tvshowsService.update(req.params.id, req.body);
  if (!show) throw new AppError("Serie no encontrada", 404);
  res.json(show);
});

exports.deleteTVShow = catchAsync(async (req, res, _next) => {
  await tvshowsService.delete(req.params.id);
  res.json({ message: "Serie eliminada exitosamente" });
});
