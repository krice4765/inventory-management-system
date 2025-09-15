import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'

describe('authStore', () => {
  beforeEach(() => {
    // ストアの状態をリセット
    useAuthStore.setState({
      user: null,
      loading: false,
    })
  })

  it('初期状態が正しく設定される', () => {
    const { user, loading } = useAuthStore.getState()

    expect(user).toBeNull()
    expect(loading).toBe(false)
  })

  it('ユーザーを正しく設定できる', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: {
        name: 'テストユーザー'
      }
    }

    useAuthStore.getState().setUser(mockUser as any)

    const { user } = useAuthStore.getState()
    expect(user).toEqual(mockUser)
  })

  it('ローディング状態を正しく設定できる', () => {
    useAuthStore.getState().setLoading(true)

    const { loading } = useAuthStore.getState()
    expect(loading).toBe(true)
  })

  it('ログアウト時にユーザーがnullになる', () => {
    // まずユーザーを設定
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com'
    }
    useAuthStore.getState().setUser(mockUser as any)

    // ログアウト（ユーザーをnullに設定）
    useAuthStore.getState().setUser(null)

    const { user } = useAuthStore.getState()
    expect(user).toBeNull()
  })

  it('複数の状態更新が正しく動作する', () => {
    const { setUser, setLoading } = useAuthStore.getState()

    setLoading(true)
    expect(useAuthStore.getState().loading).toBe(true)

    const mockUser = {
      id: 'user-456',
      email: 'user@example.com'
    }
    setUser(mockUser as any)
    expect(useAuthStore.getState().user).toEqual(mockUser)

    setLoading(false)
    expect(useAuthStore.getState().loading).toBe(false)
  })
})