import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './utils/AuthContext';
import App from './App';
import './styles/global.css';
// Shared design system (tokens + base + portal theme). Loaded after the
// legacy sheet so it can refine it; revert with USE_DS_THEME in config.
import './styles/ds/base.css';
import './styles/ds/portal.css';
import { USE_DS_THEME } from './config/designFlags';

if (USE_DS_THEME) document.documentElement.classList.add('ds');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
