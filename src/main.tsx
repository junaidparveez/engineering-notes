import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppStateProvider } from './state/AppStateContext';
import './styles/global.css';

/**
 * Entry point. StrictMode is development-only: it deliberately runs effects
 * twice to surface missing cleanup. If something looks like it happens twice
 * in dev and once in production, this is why.
 *
 * AppStateProvider sits above the router so progress survives navigation -
 * changing route re-renders the pages, not the provider.
 */
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AppStateProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppStateProvider>
  </StrictMode>,
);
