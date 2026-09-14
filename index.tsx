import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PAPER_DECALS, LINEN } from './components/paperArt';
import { OAK_TILE, LEATHER_TILE, LINEN_TILE } from './components/materialPlate';
import { CREST } from './components/titleArt';

// The paper decals (a coffee ring, a splash, a torn edge) ride in as custom
// properties, so index.css can place them without carrying the blobs itself.
// Every rule that reads one has a fallback, so this failing costs a flourish.
for (const [name, uri] of Object.entries({ ...PAPER_DECALS, '--paper-linen': LINEN, '--tex-oak': OAK_TILE, '--tex-leather': LEATHER_TILE, '--tex-linen': LINEN_TILE })) {
  document.documentElement.style.setProperty(name, `url("${uri}")`);
}

// The brass crest is the tab icon too; the page had none.
const icon = document.createElement('link');
icon.rel = 'icon';
icon.href = CREST;
document.head.appendChild(icon);

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