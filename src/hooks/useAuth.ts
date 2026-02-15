import { useState, useEffect } from 'react';

export type UserProfile = {
  tag: string;
  name: string;
  role: string;
  th: string;
  loginAt: number; // Timestamp
};

const AUTH_KEY = 'coc:user:auth';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const profile: UserProfile = JSON.parse(stored);
        const now = Date.now();
        
        // Kiểm tra hết hạn phiên (24h)
        if (now - profile.loginAt > SESSION_DURATION) {
          localStorage.removeItem(AUTH_KEY);
          setUser(null);
        } else {
          setUser(profile);
        }
      } catch (e) {
        localStorage.removeItem(AUTH_KEY);
      }
    }
  }, []);

  const login = (data: Omit<UserProfile, 'loginAt'>) => {
    const profile: UserProfile = { ...data, loginAt: Date.now() };
    setUser(profile);
    localStorage.setItem(AUTH_KEY, JSON.stringify(profile));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return { user, login, logout, isAuthenticated: !!user };
}
