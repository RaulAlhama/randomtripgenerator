import { createContext, useState, useCallback, useEffect, useRef, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const auth0ClientRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const res = await fetch('/api/auth-config');
        const config = await res.json();

        if (!config.enabled) {
          setAuthEnabled(false);
          setLoading(false);
          return;
        }

        setAuthEnabled(true);

        const { createAuth0Client } = await import('@auth0/auth0-spa-js');
        const client = await createAuth0Client({
          domain: config.domain,
          clientId: config.clientId,
          cacheLocation: 'localstorage',
          authorizationParams: {
            audience: config.audience,
            redirect_uri: window.location.origin,
          },
        });

        auth0ClientRef.current = client;

        // Handle redirect callback
        const query = window.location.search;
        if (query.includes('code=') && query.includes('state=')) {
          await client.handleRedirectCallback();
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check authentication state
        const authenticated = await client.isAuthenticated();
        if (!cancelled) {
          setIsAuthenticated(authenticated);
          if (authenticated) {
            const userInfo = await client.getUser();
            setUser(userInfo);
          }
        }
      } catch (error) {
        console.error('Error de autenticacion:', error);
        if (!cancelled) {
          setAuthEnabled(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    if (auth0ClientRef.current) {
      await auth0ClientRef.current.loginWithRedirect();
    }
  }, []);

  const logout = useCallback(async () => {
    if (auth0ClientRef.current) {
      await auth0ClientRef.current.logout({
        logoutParams: { returnTo: window.location.origin },
      });
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    if (!auth0ClientRef.current) return null;
    try {
      return await auth0ClientRef.current.getTokenSilently();
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext value={{
      user,
      isAuthenticated,
      authEnabled,
      loading,
      login,
      logout,
      getAccessToken,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
