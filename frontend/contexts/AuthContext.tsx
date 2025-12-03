/**
 * 认证状态管理 Context
 * v3.0 - 简化为使用 localStorage
 *
 * 变更历史：
 * - v3.0: 移除 Supabase Auth，使用 localStorage 会话管理
 * - v2.0: 迁移到 Supabase Auth，使用 onAuthStateChange 监听状态
 * - v1.1: UserCenter JWT Token 完整认证实现
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CurrentUser, getCurrentUser, login as authLogin, logout as authLogout } from '../services/authService';

// Context 类型定义
interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证状态 Provider
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化时从 localStorage 读取用户
    const savedUser = getCurrentUser();
    setUser(savedUser);
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const loggedInUser = await authLogin(username, password);
    setUser(loggedInUser);
  };

  const logout = () => {
    authLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 使用认证 Context 的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
