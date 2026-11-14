import { createContext, useContext } from 'react';

// Sign-in is switched off in the client (2026-11-14): in eight months it stored
// two routes from two accounts, while the header button contradicted "sin
// registro". Routes are kept on the device by RoutesContext, which never needed
// an account.
//
// The provider stays so every consumer keeps its signed-out path, and so turning
// it back on is this one file: the Auth0 version is in git history (it fetched
// /api/auth-config and loaded @auth0/auth0-spa-js, also removed from
// package.json). The backend's /api/trips endpoints are untouched.
const DISABLED = {
  user: null,
  isAuthenticated: false,
  authEnabled: false,
  loading: false,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => null,
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  return <AuthContext value={DISABLED}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
