
import { ZodError } from "zod";

export const errorHandler = (error, _request, response, _next) => {
  // Do not attempt to send another response if headers have already been sent.
  if (response.headersSent) {
    console.error("Error after response headers were sent:", error);
    response.destroy(error);
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      message: "Please correct the highlighted fields.",
      errors: error.flatten(),
    });

    return;
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";

    response.status(409).json({
      success: false,
      message: `That ${field} is already in use.`,
    });

    return;
  }

  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    response.status(401).json({
      success: false,
      message: "Your session is invalid or has expired.",
    });

    return;
  }

  const status = error.statusCode || 500;

  const message =
    status >= 500
      ? "Something went wrong on the server."
      : error.message;

  if (status >= 500) {
    console.error(error);
  }

  response.status(status).json({
    success: false,
    message,
  });
};
