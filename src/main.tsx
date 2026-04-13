import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);