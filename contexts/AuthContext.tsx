import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { checkAdminStatus } from '../services/authService'
import { supabase } from '../services/authService'
import { User } from '@supabase/supabase-js' // Use Supabase type directly if possible, or our custom interface

// Use our custom User interface matching the one in authService (re-declared here to match existing file structure if needed, or import)
// Since authService exports a User interface, let's stick to the local definition or imports.
// Ideally, we should just use the type from authService.
import { User as CustomUser } from '../services/authService' 

interface AuthState {
  user: CustomUser | null
  loading: boolean
  isAdmin: boolean
}

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

  useEffect(() => {
    // supabase.auth.onAuthStateChange handles the initial check and all subsequent auth events.
    // It will fire with an 'INITIAL_SESSION' event when the component mounts.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
  }, [])

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
      // onAuthStateChange will handle the state update
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