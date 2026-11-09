import { AppError } from "../utils/app-error.js";

export const notFound = (request, _response, next) => {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, 404));
};

