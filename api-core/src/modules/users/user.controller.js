const AuditLog = require("../../common/audit.model");
/** @type {any} */
const User = require("./user.model");
/** @type {any} */
const Movie = require("../catalog/movie.model");
/** @type {any} */
const Review = require("../reviews/review.model");

const axios = require("axios");
const audit = require("../../common/audit.service");
const catalogApi = require("../catalog/catalog.api");
const { catchAsync, AppError } = require("../../common/error.utils");

/**
 * @typedef {Object} UserDoc
 * @property {string} _id
 * @property {string} username
 * @property {function(): Promise<UserDoc>} save
 * @property {Array<{
 *   contentId: string,
 *   contentType?: string,
 *   percentWatched: number,
 *   currentTime?: number,
 *   lastTimeWatched?: Date
 * }>} watchHistory
 * @property {Array<{item: string, kind: string, _id: string}>} watchlist
 */

exports.getBossStats = catchAsync(async (req, res, _next) => {
  const [totalUsers, totalMovies, totalReviews] = await Promise.all([
    User.countDocuments(),
    Movie.countDocuments(),
    Review.countDocuments(),
  ]);

  const topRated = await Movie.find().sort({ voteAverage: -1 }).limit(5);

  res.json({
    metrics: { totalUsers, totalMovies, totalReviews },
    rankings: topRated,
  });
});

exports.getRecommendations = catchAsync(async (req, res, _next) => {
  /** @type {UserDoc|null} */
  const user = await User.findById(req.user.id);

  let preferredGenres = ["Acción"];

  if (user?.watchlist?.length) {
    const movieIds = user.watchlist
      .filter((i) => i.kind === "Movie")
      .map((i) => i.item);

    if (movieIds.length > 0) {
      const watchedMovies = await Movie.find({
        _id: { $in: movieIds },
      })
        .select("genres")
        .limit(20);

      const genreCount = {};

      for (const movie of watchedMovies) {
        for (const genre of movie.genres || []) {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
      }

      const sorted = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .map(([genre]) => genre);

      if (sorted.length > 0) {
        preferredGenres = sorted.slice(0, 4);
      }
    }
  }

  const AI_URL = process.env.AI_ENGINE_URL || "http://localhost:5000";

  try {
    const response = await axios.post(
      `${AI_URL}/recommend`,
      {
        userId: req.user.id,
        preferredGenres,
        limit: 6,
      },
      { timeout: 4000 }
    );

    const tmdbIds = response.data.recommendations || [];

    res.json(await catalogApi.getRecommendedContent(tmdbIds));
  } catch (_aiErr) {
    res.json(await catalogApi.getRecommendedContent([]));
  }
});

exports.getMe = catchAsync(async (req, res, _next) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  res.json(user);
});

exports.updateMe = catchAsync(async (req, res, _next) => {
  const { username } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const oldName = user.username;

  if (username && username !== user.username) {
    if (await User.findOne({ username })) {
      throw new AppError("Usuario ya existe.", 400);
    }

    user.username = username;
  }

  await user.save();

  await audit.recordMutation(
    req.user.id,
    "USER_PROFILE_MUTATION",
    { from: oldName, to: user.username },
    req.ip
  );

  res.json(user);
});


exports.getWatchlist = catchAsync(async (req, res, _next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  /** @type {UserDoc} */
  const userDoc = user;

  const movieIds = userDoc.watchlist
    .filter((i) => i.kind === "Movie")
    .map((i) => i.item);

  const tvIds = userDoc.watchlist
    .filter((i) => i.kind === "TVShow")
    .map((i) => i.item);

  const { movies, tvshows } = await catalogApi.getBulkItems(
    movieIds,
    tvIds
  );

  const finalWatchlist = userDoc.watchlist
    .map((entry) => {
      const data =
        entry.kind === "Movie"
          ? movies.find((m) => m._id.toString() === entry.item.toString())
          : tvshows.find((t) => t._id.toString() === entry.item.toString());

      return data
        ? { _id: entry._id, kind: entry.kind, item: data }
        : null;
    })
    .filter(Boolean);

  res.json({ watchlist: finalWatchlist });
});

exports.getAllUsers = catchAsync(async (req, res, _next) => {
  const users = await User.find().select("-password");
  res.json(users);
});

exports.updateUserRole = catchAsync(async (req, res, _next) => {
  const { role } = req.body;

  if (!["user", "tecnico", "admin"].includes(role)) {
    throw new AppError("Rol no válido", 400);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const oldRole = user.role;

  user.role = role;

  await user.save();

  await audit.recordMutation(
    req.user.id,
    "USER_ROLE_MUTATION",
    { targetUser: user.username, from: oldRole, to: role },
    req.ip
  );

  res.json({ message: "Rol actualizado exitosamente", user });
});

exports.toggleWatchlist = catchAsync(async (req, res) => {
  const { itemId, itemType } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const kind = itemType === "movie" ? "Movie" : "TVShow";

  const index = user.watchlist.findIndex(
    (w) => w.item.toString() === itemId
  );

  if (index > -1) {
    user.watchlist.splice(index, 1);
  } else {
    user.watchlist.push({ item: itemId, kind });
  }

  await user.save();

  await audit.recordMutation(
    req.user.id,
    "WATCHLIST_TOGGLE",
    { itemId, kind },
    req.ip
  );

  res.json(user.watchlist);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");

  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(
      new AppError("La contraseña actual es incorrecta.", 401)
    );
  }

  user.password = newPassword;

  await user.save();

  res.json({ message: "Contraseña actualizada con éxito." });
});


exports.getActivityMetrics = catchAsync(async (req, res, _next) => {
  const days = parseInt(req.query.days, 10) || 7;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const dailyData = await AuditLog.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$timestamp",
            timezone: "America/Lima",
          },
        },
        activeUsers: { $addToSet: "$userId" },
      },
    },
    {
      $project: {
        date: "$_id",
        activeUsers: { $size: "$activeUsers" },
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);

  const actionSummary = await AuditLog.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: "$action",
        uniqueUsers: { $addToSet: "$userId" },
        totalOccurrences: { $sum: 1 },
      },
    },
    {
      $project: {
        action: "$_id",
        userCount: { $size: "$uniqueUsers" },
        total: "$totalOccurrences",
        _id: 0,
      },
    },
    { $sort: { userCount: -1 } },
  ]);

  res.json({ daily: dailyData, summary: actionSummary });
});