import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
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

  // Ref to track the last processed user ID to prevent redundant admin checks
  const lastProcessedUserId = useRef<string | null>(null)

  useEffect(() => {
    // supabase.auth.onAuthStateChange handles the initial check and all subsequent auth events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUserId = session?.user?.id || null

      // Optimization: If user hasn't changed, skip re-fetching admin status.
      // This prevents double-firing on initial load (INITIAL_SESSION + SIGNED_IN).
      if (currentUserId === lastProcessedUserId.current) {
        // If we are just starting up (loading=true), we might still want to ensure state is set,
        // but usually onAuthStateChange fires reliably.
        // If we are already loaded, we definitely skip.
        if (!authState.loading) return
      }

      lastProcessedUserId.current = currentUserId

      if (session?.user) {
        try {
          // User is logged in, check admin status
          const isAdmin = await checkAdminStatus(session.user.email || '')
          
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
      } else {
        // No session (logged out or initial load failed)
        setAuthState({
          user: null,
          loading: false,
          isAdmin: false
        })
      }
    })

    return () => {
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
      lastProcessedUserId.current = null // Reset tracker on sign out
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