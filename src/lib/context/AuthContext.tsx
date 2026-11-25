"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setAuthToken, getAuthToken, apiFetch } from "@/lib/api/client";

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  restaurantId: string;
  restaurantName?: string;
  phone?: string;
}

export interface RegisterData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  restaurantName: string;
  restaurantType?: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  fssaiNumber?: string;
  businessHours?: string;
  upiVpa?: string;
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check localStorage on mount
    try {
      const storedToken = localStorage.getItem("chotu_auth_token");
      const storedUser = localStorage.getItem("chotu_user_session");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setAuthToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        // Genuine unauthenticated state — no fake demo credentials
        setUser(null);
        setToken(null);
        setAuthToken(null);
      }
    } catch {
      setUser(null);
      setToken(null);
      setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        access_token: string;
        user_id: string;
        role: string;
        restaurant_id: string;
        restaurant_name?: string;
        full_name: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });

      const session: UserSession = {
        userId: data.user_id,
        email: identifier.includes("@") ? identifier : "",
        fullName: data.full_name,
        role: data.role,
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant_name || "Restaurant",
      };

      setToken(data.access_token);
      setUser(session);
      setAuthToken(data.access_token);
      localStorage.setItem("chotu_auth_token", data.access_token);
      localStorage.setItem("chotu_user_session", JSON.stringify(session));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (regData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const payload = {
        full_name: regData.fullName,
        email: regData.email,
        phone: regData.phone,
        password: regData.password,
        restaurant_name: regData.restaurantName,
        restaurant_type: regData.restaurantType || "dinein",
        address: regData.address,
        city: regData.city,
        state: regData.state || null,
        pincode: regData.pincode || null,
        country: regData.country || "India",
        gstin: regData.gstin || null,
        fssai_number: regData.fssaiNumber || null,
        business_hours: regData.businessHours || "11:00 AM - 11:00 PM",
        upi_vpa: regData.upiVpa || null,
      };

      const data = await apiFetch<{
        access_token: string;
        user_id: string;
        role: string;
        restaurant_id: string;
        restaurant_name: string;
        full_name: string;
        email: string;
        phone?: string;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const session: UserSession = {
        userId: data.user_id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        restaurantId: data.restaurant_id,
        restaurantName: data.restaurant_name,
        phone: data.phone,
      };

      setToken(data.access_token);
      setUser(session);
      setAuthToken(data.access_token);
      localStorage.setItem("chotu_auth_token", data.access_token);
      localStorage.setItem("chotu_user_session", JSON.stringify(session));

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("chotu_auth_token");
      localStorage.removeItem("chotu_user_session");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
