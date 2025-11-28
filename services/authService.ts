import { createClient } from '@supabase/supabase-js'
import { Gem, AppConfig, User, AuthState, AuthResponse } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Authentication functions
export const signIn = async (): Promise<AuthResponse> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })

    if (error) {
      return { user: null, error: error.message }
    }

    // OAuth flow will redirect, so we won't get user here
    return { user: null }
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

export const signOut = async (): Promise<void> => {
  await supabase.auth.signOut()
}

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email || undefined,
      user_metadata: user.user_metadata || {}
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

export const checkAdminStatus = async (email: string): Promise<boolean> => {
  try {
    // Backend now handles the email check securely based on the token
    const token = await getAccessToken()
    if (!token) {
      return false
    }

    const response = await fetch('/api/auth/check-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email }) // Body is now ignored by backend but kept for schema compat
    })

    if (!response.ok) {
      console.warn('[authService] check-admin failed:', response.statusText)
      return false
    }

    const data = await response.json()
    return data.isAdmin || false
  } catch (error) {
    console.error('[authService] Error checking admin status:', error)
    return false
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return null
    }

    return session.access_token || null
  } catch (error) {
    console.error('Error getting access token:', error)
    return null
  }
}

export const registerFirstAdmin = async (email: string): Promise<boolean> => {
  try {
    const token = await getAccessToken()
    // This endpoint is protected now, but we might not have a token if we aren't logged in.
    // However, registering an admin implies you want to make the current user an admin.
    // If this logic flow is "register the FIRST user", they might not be logged in?
    // Based on previous code, this was called presumably when a user IS logged in.
    
    if (!token) {
      // If we don't have a token, we can't call the protected endpoint.
      // But wait, was this intended to be called publicly?
      // The backend change I made REMOVED public access.
      // So we MUST have a token.
      console.warn("Cannot register admin without being logged in first.")
      return false
    }

    const response = await fetch('/api/auth/register-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to register admin')
    }

    return true
  } catch (error) {
    console.error('Error registering admin:', error)
    return false
  }
}

export const createGemWithAuth = async (gem: Omit<Gem, 'id' | 'created_at'>, config: AppConfig): Promise<Gem> => {
  if (config.useLocalStorage) {
    const newGem = {
      ...gem,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    }

    const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]')
    const updated = [newGem, ...stored]
    localStorage.setItem('gemini_gems_data', JSON.stringify(updated))
    return newGem
  }

  const token = await getAccessToken()
  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch('/api/gems', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(gem)
  })

  if (!response.ok) {
    throw new Error(`Failed to create gem: ${response.statusText}`)
  }

  return await response.json()
}

export const updateGemWithAuth = async (gem: Gem, config: AppConfig): Promise<Gem> => {
  if (config.useLocalStorage) {
    const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]')
    const updated = stored.map((g: Gem) => g.id === gem.id ? gem : g)
    localStorage.setItem('gemini_gems_data', JSON.stringify(updated))
    return gem
  }

  const token = await getAccessToken()
  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch(`/api/gems/${gem.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(gem)
  })

  if (!response.ok) {
    throw new Error(`Failed to update gem: ${response.statusText}`)
  }

  return await response.json()
}

export const deleteGemWithAuth = async (id: string, config: AppConfig): Promise<void> => {
  if (config.useLocalStorage) {
    const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]')
    const updated = stored.filter((g: Gem) => g.id !== id)
    localStorage.setItem('gemini_gems_data', JSON.stringify(updated))
    return
  }

  const token = await getAccessToken()
  if (!token) {
    throw new Error('Authentication required')
  }

  const response = await fetch(`/api/gems/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to delete gem: ${response.statusText}`)
  }
}

export const getGemsWithAuth = async (config: AppConfig): Promise<Gem[]> => {
  if (config.useLocalStorage) {
    return JSON.parse(localStorage.getItem('gemini_gems_data') || '[]')
  }

  const token = await getAccessToken()
  if (!token) {
    // If no token, we can't get gems from backend anymore since it's protected.
    // Return empty or throw?
    // Let's return empty to avoid crashing the UI, but log it.
    console.warn("No auth token available, cannot fetch gems.")
    return []
  }

  const response = await fetch('/api/gems', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch gems: ${response.statusText}`)
  }

  return await response.json()
}
