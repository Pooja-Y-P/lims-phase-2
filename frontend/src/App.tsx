import { AuthProvider } from './auth/AuthProvider';
import AppRoutes from './routes/AppRoutes';
import TokenExpirationNotification from './components/TokenExpirationNotification';

/**
 * The main App component.
 * It sets up the global context providers that the rest of the application will use.
 */
function App() {
  return (
    // The AuthProvider wraps the entire routing system, making user session data
    // available to all pages and components.
    <AuthProvider>
      {/* If you had other global providers (e.g., for theme, notifications),
          you would wrap them here as well. */}

      <TokenExpirationNotification />
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;