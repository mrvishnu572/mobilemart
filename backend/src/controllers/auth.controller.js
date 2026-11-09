import { asyncHandler } from "../utils/async-handler.js";
import * as authService from "../services/auth.service.js";

export const sendRegistrationOtp = asyncHandler(async (request, response) => {
  const result = await authService.sendRegistrationOtp(request.body);
  response.status(200).json({ success: true, data: result });
});

export const verifyRegistrationOtp = asyncHandler(async (request, response) => {
  const result = await authService.verifyRegistrationOtp(request.body);
  response.status(201).json({ success: true, data: result });
});

export const login = asyncHandler(async (request, response) => {
  const result = await authService.loginUser(request.body);
  response.status(200).json({ success: true, data: result });
});

export const loginGoogle = asyncHandler(async (request, response) => {
  const result = await authService.loginWithGoogle(request.body);
  response.status(200).json({ success: true, data: result });
});

export const forgotPassword = asyncHandler(async (request, response) => {
  const result = await authService.forgotPassword(request.body);
  response.status(200).json({ success: true, data: result });
});

export const resetPassword = asyncHandler(async (request, response) => {
  const result = await authService.resetPassword(request.body);
  response.status(200).json({ success: true, data: result });
});

export const sendOtp = asyncHandler(async (request, response) => {
  const result = await authService.sendEmailOtp(request.body);
  response.status(200).json({ success: true, data: result });
});

export const verifyOtp = asyncHandler(async (request, response) => {
  const result = await authService.verifyEmailOtp(request.body);
  response.status(200).json({ success: true, data: result });
});

export const getMe = asyncHandler(async (request, response) => {
  const user = await authService.getUserProfile(request.user.id);
  response.status(200).json({ success: true, data: { user } });
});

export const updateMe = asyncHandler(async (request, response) => {
  const user = await authService.updateUserProfile(request.user.id, request.body);
  response.status(200).json({ success: true, data: { user } });
});

export const changePassword = asyncHandler(async (request, response) => {
  const result = await authService.changeUserPassword(request.user.id, request.body);
  response.status(200).json({ success: true, data: result });
});
