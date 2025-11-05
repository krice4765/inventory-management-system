import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import type { UserProfile } from '../types';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useAuthStore.getState();
    store.setUser(null);
    store.setUserProfile(null);
    store.setLoading(true);
  });

  describe('Initial State', () => {
    it('should have initial state with user as null', () => {
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should have initial state with userProfile as null', () => {
      const { userProfile } = useAuthStore.getState();
      expect(userProfile).toBeNull();
    });

    it('should have initial state with loading as true', () => {
      const { loading } = useAuthStore.getState();
      expect(loading).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should set user to non-null value', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: '2024-01-01T00:00:00.000Z',
        app_metadata: {},
        user_metadata: {},
      } as any;

      useAuthStore.getState().setUser(mockUser);
      const { user } = useAuthStore.getState();
      expect(user).toEqual(mockUser);
    });

    it('should set user to null', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('should update user email when changed', () => {
      const mockUser1 = {
        id: 'user-123',
        email: 'old@example.com',
      } as any;

      const mockUser2 = {
        id: 'user-123',
        email: 'new@example.com',
      } as any;

      useAuthStore.getState().setUser(mockUser1);
      useAuthStore.getState().setUser(mockUser2);
      const { user } = useAuthStore.getState();
      expect(user?.email).toBe('new@example.com');
    });
  });

  describe('setUserProfile', () => {
    it('should set userProfile to non-null value', () => {
      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUserProfile(mockProfile);
      const { userProfile } = useAuthStore.getState();
      expect(userProfile).toEqual(mockProfile);
    });

    it('should set userProfile to null', () => {
      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUserProfile(mockProfile);
      useAuthStore.getState().setUserProfile(null);
      const { userProfile } = useAuthStore.getState();
      expect(userProfile).toBeNull();
    });

    it('should update userProfile role when changed', () => {
      const mockProfile1: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      const mockProfile2: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUserProfile(mockProfile1);
      useAuthStore.getState().setUserProfile(mockProfile2);
      const { userProfile } = useAuthStore.getState();
      expect(userProfile?.role).toBe('admin');
    });

    it('should handle admin role correctly', () => {
      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUserProfile(mockProfile);
      const { userProfile } = useAuthStore.getState();
      expect(userProfile?.role).toBe('admin');
    });
  });

  describe('setLoading', () => {
    it('should set loading to true', () => {
      useAuthStore.getState().setLoading(false);
      useAuthStore.getState().setLoading(true);
      const { loading } = useAuthStore.getState();
      expect(loading).toBe(true);
    });

    it('should set loading to false', () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      const { loading } = useAuthStore.getState();
      expect(loading).toBe(false);
    });

    it('should toggle loading state', () => {
      const initialLoading = useAuthStore.getState().loading;
      useAuthStore.getState().setLoading(!initialLoading);
      const { loading } = useAuthStore.getState();
      expect(loading).toBe(!initialLoading);
    });
  });

  describe('Combined State Updates', () => {
    it('should update user and userProfile together', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUserProfile(mockProfile);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.userProfile).toEqual(mockProfile);
    });

    it('should clear user and userProfile on logout', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUserProfile(mockProfile);
      useAuthStore.getState().setUser(null);
      useAuthStore.getState().setUserProfile(null);

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.userProfile).toBeNull();
    });

    it('should handle authentication flow: loading -> authenticated -> loading finished', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      } as any;

      const mockProfile: UserProfile = {
        id: 'profile-123',
        user_id: 'user-123',
        full_name: 'Test User',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      // Initial loading state
      expect(useAuthStore.getState().loading).toBe(true);

      // Set authenticated user
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUserProfile(mockProfile);

      // Finish loading
      useAuthStore.getState().setLoading(false);

      const state = useAuthStore.getState();
      expect(state.loading).toBe(false);
      expect(state.user).toEqual(mockUser);
      expect(state.userProfile).toEqual(mockProfile);
    });
  });
});
