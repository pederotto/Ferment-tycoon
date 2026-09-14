import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PAPER_DECALS, LINEN, OAK, LEATHER } from './components/paperArt';

// The paper decals (a coffee ring, a splash, a torn edge) ride in as custom
// properties, so index.css can place them without carrying the blobs itself.
// Every rule that reads one has a fallback, so this failing costs a flourish.
for (const [name, uri] of Object.entries({ ...PAPER_DECALS, '--paper-linen': LINEN, '--oak-grain': OAK, '--leather-grain': LEATHER })) {
  document.documentElement.style.setProperty(name, `url("${uri}")`);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);