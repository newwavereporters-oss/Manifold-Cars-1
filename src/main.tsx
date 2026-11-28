import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DealerAuthProvider } from './context/DealerAuthContext';
import { RoleProvider } from './context/RoleContext';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DealerAuthProvider>
      <RoleProvider>
        <App />
        <OfflineIndicator />
      </RoleProvider>
    </DealerAuthProvider>
  </AuthProvider>
);
