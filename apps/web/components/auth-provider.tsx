"use client"

/**
 * Clerk-based Auth Provider
 * This replaces the old Supabase auth provider
 * Use Clerk hooks directly: useUser, useOrganization, useAuth from @clerk/nextjs
 */

import { createContext, useContext } from 'react'
import { useUser } from '@clerk/nextjs'

interface AuthContextType {
  user: any | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * @deprecated This provider is kept for backward compatibility
 * New code should use Clerk hooks directly:
 * - useUser() for user data
 * - useOrganization() for org data
 * - useAuth() from @clerk/nextjs for auth state
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()

  return (
    <AuthContext.Provider value={{ user, loading: !isLoaded }}>
      {children}
    </AuthContext.Provider>
  )
}
