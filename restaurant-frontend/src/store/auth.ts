import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, LoginData, OAuthProviderType, RegisterData, User } from '@/lib/api-client';
import toast from 'react-hot-toast';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  loginWithOAuth: (provider: OAuthProviderType) => Promise<void>;
  syncFirebaseUser: (payload?: { name?: string; phone?: string }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => void;
  getProfile: () => Promise<void>;
  getEnhancedProfile: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (data: LoginData) => {
        try {
          set({ isLoading: true, error: null });
          const response = await apiClient.login(data);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          toast.error(errorMessage);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        try {
          set({ isLoading: true, error: null });
          const response = await apiClient.register(data);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          toast.error(errorMessage);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      loginWithOAuth: async (provider: OAuthProviderType) => {
        try {
          set({ isLoading: true, error: null });
          const response = await apiClient.loginWithOAuth(provider);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'OAuth login failed';
          toast.error(errorMessage);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      syncFirebaseUser: async (payload: { name?: string; phone?: string } = {}) => {
        try {
          set({ isLoading: true, error: null });
          const response = await apiClient.syncCurrentFirebaseUser(payload);
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to complete authentication';
          toast.error(errorMessage);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      sendPasswordReset: async (email: string) => {
        try {
          set({ isLoading: true, error: null });
          await apiClient.sendPasswordReset(email);
          set({ isLoading: false, error: null });
          toast.success('Password reset email sent');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send password reset email';
          toast.error(errorMessage);
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      logout: () => {
        apiClient.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        toast.success('You have been logged out successfully');
      },

      getProfile: async () => {
        try {
          set({ isLoading: true, error: null });
          const user = await apiClient.getProfile();
          set({
            user,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get profile';
          toast.error(errorMessage);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
        }
      },

      getEnhancedProfile: async () => {
        try {
          set({ isLoading: true, error: null });
          const enhancedUser = await apiClient.getEnhancedProfile();
          set({
            user: enhancedUser,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get enhanced profile';
          toast.error(errorMessage);
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        try {
          set({ isLoading: true, error: null });
          await apiClient.changePassword(currentPassword, newPassword);
          set({ isLoading: false, error: null });
          toast.success('Password changed successfully!');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
          toast.error(errorMessage);
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token) return;
        if (typeof window === 'undefined') return;
        localStorage.setItem('auth_token', state.token);
      },
    }
  )
);

