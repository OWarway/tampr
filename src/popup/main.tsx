import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { startDevReloadWatcher } from '../dev/reload-extension';
import { App } from './App';

import './popup.scss';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Popup root not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.MODE === 'development') {
  startDevReloadWatcher();
}
