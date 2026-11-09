import User from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/token.js";
import { asyncHandler } from "../utils/async-handler.js";

export const requireAuth = asyncHandler(async (request, _response, next) => {
  const authorization = request.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Authentication is required.", 401);
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user || user.accountStatus !== "active") {
    throw new AppError("Your account is unavailable.", 401);
  }

  request.user = user;
  next();
});

export const requireRole = (...roles) => (request, _response, next) => {
  if (!roles.includes(request.user.role)) {
    next(new AppError("You are not allowed to perform this action.", 403));
    return;
  }

  next();
};

