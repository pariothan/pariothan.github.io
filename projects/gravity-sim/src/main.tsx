import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('Root element not found');
  throw new Error('Root element not found');
}

window.addEventListener('error', (e) => {
  console.error('Global error:', (e as ErrorEvent).error || (e as ErrorEvent).message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', (e as PromiseRejectionEvent).reason);
});

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
