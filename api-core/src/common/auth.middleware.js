const jwt = require("jsonwebtoken");

exports.optionalAuth = (req, res, next) => {
    const token = req.header('x-auth-token') || req.header('Authorization');
    if (!token) return next();

    try {
        const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
        req.user = jwt.verify(tokenString, process.env.JWT_SECRET);
        next();
    } catch (err) {
        next(); // Si el token falla, lo dejamos pasar como anónimo
    }
};

exports.requiredAuth = (req, res, next) => {
  const token = req.header("x-auth-token") || req.header("Authorization");
  if (!token) return res.status(401).json({ message: "No hay token." });

  try {
    const tokenString = token.startsWith("Bearer ") ? token.slice(7) : token;
    req.user = jwt.verify(tokenString, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: "Token no válido." });
  }
};
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado." });
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "No tienes permisos para realizar esta acción." });
    }

    next();
  };
};

exports.authorize = authorize;
