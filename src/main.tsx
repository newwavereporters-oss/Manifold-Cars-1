import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DealerAuthProvider } from './context/DealerAuthContext';
import { RoleProvider } from './context/RoleContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <DealerAuthProvider>
      <RoleProvider>
        <App />
      </RoleProvider>
    </DealerAuthProvider>
  </AuthProvider>
);
