import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { checkAdminStatus, supabase } from '../services/authService'
import { AuthState } from '../types'

interface AuthContextType {
  authState: AuthState
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAdmin: false
  })

  const adminCheckIdRef = useRef(0)

  useEffect(() => {
    console.log('[AuthContext] Initializing auth listener...')

    let isMounted = true

    const clearAuthHash = () => {
      if (!window.location.hash.includes('access_token=')) {
        return
      }

      const cleanUrl = `${window.location.pathname}${window.location.search}`
      window.history.replaceState({}, document.title, cleanUrl)
    }

    const applySession = async (session: Session | null) => {
      const currentCheckId = ++adminCheckIdRef.current

      if (!session?.user) {
        console.log('[AuthContext] No user session.')
        if (!isMounted) return

        setAuthState({
          user: null,
          loading: false,
          isAdmin: false
        })
        return
      }

      try {
        console.log('[AuthContext] User found, checking admin status...')
        const isAdmin = await checkAdminStatus(session.user.email || '')
        console.log(`[AuthContext] Admin status: ${isAdmin}`)

        if (!isMounted || currentCheckId !== adminCheckIdRef.current) return

        clearAuthHash()
        setAuthState({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata || {}
          },
          loading: false,
          isAdmin
        })
      } catch (error) {
        console.error('[AuthContext] Error checking admin status:', error)
        if (!isMounted || currentCheckId !== adminCheckIdRef.current) return

        clearAuthHash()
        setAuthState({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            user_metadata: session.user.user_metadata || {}
          },
          loading: false,
          isAdmin: false
        })
      }
    }

    const timeoutId = setTimeout(() => {
      setAuthState(prev => {
        if (prev.loading) {
          console.warn('[AuthContext] Auth check timed out. Forcing load completion.')
          return { ...prev, loading: false }
        }
        return prev
      })
    }, 5000)

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          throw error
        }
        return applySession(data.session)
      })
      .catch((error) => {
        console.error('[AuthContext] Failed to get initial session:', error)
        if (!isMounted) return
        setAuthState({
          user: null,
          loading: false,
          isAdmin: false
        })
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthContext] Auth event: ${event}`, session?.user?.id)
      void applySession(session)
    })

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignIn = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))

    if (!supabase) {
      setAuthState(prev => ({ ...prev, loading: false }))
      alert('Supabase is not configured. Please check your environment variables.')
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })

      if (error) throw error
      // Redirect happens, no further action needed
    } catch (error) {
      console.error('Sign in error:', error)
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }

  const handleSignOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
      setAuthState(prev => ({ ...prev, loading: false }))
    }
  }

  const value: AuthContextType = {
    authState,
    signIn: handleSignIn,
    signOut: handleSignOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
