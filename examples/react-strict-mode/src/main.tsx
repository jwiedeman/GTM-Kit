import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GtmProvider } from '@jwiedeman/gtm-kit-react';
import App, { consentDefaults } from './App';

const rawContainers = import.meta.env.VITE_GTM_CONTAINERS ?? 'GTM-XXXX';
const containers = rawContainers
  .split(',')
  .map((id: string) => id.trim())
  .filter((id: string) => id.length > 0);

if (containers.length === 0) {
  containers.push('GTM-XXXX');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <GtmProvider
      config={{
        containers,
        dataLayerName: import.meta.env.VITE_GTM_DATALAYER ?? 'dataLayer',
        logger: import.meta.env.DEV ? console : undefined
      }}
      onBeforeInit={(client) => {
        client.setConsentDefaults(consentDefaults);
        // Expose __gtmKit in DevTools for dev-only exploration. Opened as a separate
        // chunk so production builds don't ship the 1 KB inspector.
        if (import.meta.env.DEV) {
          import('@jwiedeman/gtm-kit/inspector').then(({ installInspector }) => {
            installInspector(client);
          });
        }
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GtmProvider>
  </React.StrictMode>
);
