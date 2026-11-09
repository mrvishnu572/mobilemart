import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../api/client.js";

const AuthContext = createContext(null);

const clearStoredSession = () => {
  localStorage.removeItem("mobilemart_token");
  localStorage.removeItem("mobilemart_user");
};

const storeUser = (user) => {
  localStorage.setItem("mobilemart_user", JSON.stringify(user));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const token = localStorage.getItem("mobilemart_token");

      if (!token) {
        clearStoredSession();
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const currentUser = response.data?.data?.user;

        if (!currentUser?._id || !currentUser?.role) {
          throw new Error("The server returned an invalid user session.");
        }

        if (isMounted) {
          storeUser(currentUser);
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          clearStoredSession();
          setUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveSession = useCallback(({ token, user: nextUser }) => {
    if (!token || !nextUser) {
      throw new Error("The server did not return a valid login session.");
    }

    localStorage.setItem("mobilemart_token", token);
    storeUser(nextUser);
    setUser(nextUser);
    return nextUser;
  }, []);

  const saveUser = useCallback((nextUser) => {
    storeUser(nextUser);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",

      async login(values) {
        const response = await api.post("/auth/login", values);
        return saveSession(response.data.data);
      },

      async sendRegistrationOtp(values) {
        const response = await api.post("/auth/register/send-otp", values);
        return response.data.data;
      },

      async verifyRegistrationOtp(email, code) {
        const response = await api.post("/auth/register/verify-otp", {
          email,
          code,
        });
        return saveSession(response.data.data);
      },

      async loginWithGoogle(payload) {
        const response = await api.post("/auth/google", payload);
        return saveSession(response.data.data);
      },

      async sendEmailOtp(email) {
        const response = await api.post("/auth/send-otp", { email });
        return response.data.data;
      },

      async verifyEmailOtp(email, code) {
        const response = await api.post("/auth/verify-otp", { email, code });
        return saveSession(response.data.data);
      },

      async forgotPassword(email) {
        const response = await api.post("/auth/forgot-password", { email });
        return response.data.data;
      },

      async resetPassword(token, password) {
        const response = await api.post("/auth/reset-password", {
          token,
          password,
        });
        return response.data.data;
      },

      async updateProfile(values) {
        if (!user) {
          throw new Error("You must be logged in to update your profile.");
        }

        const response = await api.patch("/auth/me", values);
        const updatedUser = response.data?.data?.user;

        if (!updatedUser) {
          throw new Error("The server did not return the updated profile.");
        }

        try {
          saveUser(updatedUser);
        } catch {
          throw new Error(
            "Your profile was saved on the server, but this browser could not update its local session.",
          );
        }

        return updatedUser;
      },

      logout,
    }),
    [user, isLoading, saveSession, saveUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
};
