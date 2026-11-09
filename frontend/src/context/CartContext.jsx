import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState({ items: [] });
  const [isLoading, setIsLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart({ items: [] });
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get("/cart");
      setCart(response.data.data.cart);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshCart().catch(() => setCart({ items: [] }));
  }, [refreshCart]);

  const value = useMemo(
    () => ({
      cart,
      isLoading,
      itemCount: cart.items.reduce((total, item) => total + item.quantity, 0),
      refreshCart,
      async addItem(values) {
        const response = await api.post("/cart/items", values);
        setCart(response.data.data.cart);
      },
      async updateItem(itemId, quantity) {
        const response = await api.patch(`/cart/items/${itemId}`, { quantity });
        setCart(response.data.data.cart);
      },
      async removeItem(itemId) {
        const response = await api.delete(`/cart/items/${itemId}`);
        setCart(response.data.data.cart);
      },
    }),
    [cart, isLoading, refreshCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
};

