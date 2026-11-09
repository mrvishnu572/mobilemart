import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mobilemart_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getApiError = (error, fallback = "Something went wrong. Please try again.") =>
  error.response?.data?.message || fallback;

