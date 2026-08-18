"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import toast from "react-hot-toast";

export interface CartItem {
  id: string;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  quantity: number;
  link: string;
  options?: Record<string, any>;
  unitPrice: number;
  totalPriceEgp: number;
  isManual?: boolean;
  addedAt: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "id" | "addedAt">) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  totalAmountEgp: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("zaitx_cart");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setCart(parsed);
        }
      } catch (e) {
        console.warn("Failed to load cart from localStorage", e);
      }
    }
  }, []);

  // Save cart to localStorage on changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("zaitx_cart", JSON.stringify(cart));
      } catch (e) {
        console.warn("Failed to save cart to localStorage", e);
      }
    }
  }, [cart]);

  const addToCart = (newItem: Omit<CartItem, "id" | "addedAt">) => {
    const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const addedItem: CartItem = {
      ...newItem,
      id: cartItemId,
      addedAt: new Date().toISOString(),
    };
    setCart((prev) => [...prev, addedItem]);
    toast.success(`تمت إضافة "${newItem.serviceName}" إلى السلة 🛒`, {
      duration: 3500,
      position: "bottom-center",
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    toast.success("تم إزالة الطلب من السلة");
  };

  const clearCart = () => {
    setCart([]);
    toast.success("تم تفريغ السلة بالكامل");
  };

  const totalAmountEgp = Math.round(
    cart.reduce((sum, item) => sum + (Number(item.totalPriceEgp) || 0), 0) * 100
  ) / 100;

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        totalAmountEgp,
        cartCount: cart.length,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
