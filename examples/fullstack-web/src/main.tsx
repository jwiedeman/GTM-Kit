import React from 'react';
import ReactDOM from 'react-dom/client';
import { GtmProvider } from '@jwiedeman/gtm-kit-react';
import App, { consentDefaults } from './App';
import './styles.css';

type QueryParams = Record<string, string>;

const rawContainers = import.meta.env.VITE_GTM_CONTAINERS ?? 'GTM-XXXX';
const containers = rawContainers
  .split(',')
  .map((id: string) => id.trim())
  .filter((id: string) => id.length > 0);

if (containers.length === 0) {
  containers.push('GTM-XXXX');
}

const defaultQueryParams: QueryParams = {};

if (import.meta.env.VITE_GTM_PREVIEW) {
  defaultQueryParams.gtm_preview = import.meta.env.VITE_GTM_PREVIEW;
}

if (import.meta.env.VITE_GTM_AUTH) {
  defaultQueryParams.gtm_auth = import.meta.env.VITE_GTM_AUTH;
}

const host = import.meta.env.VITE_GTM_HOST;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <GtmProvider
      config={{
        containers,
        dataLayerName: import.meta.env.VITE_GTM_DATALAYER ?? 'dataLayer',
        host: host && host.length > 0 ? host : undefined,
        defaultQueryParams: Object.keys(defaultQueryParams).length ? defaultQueryParams : undefined,
        logger: import.meta.env.DEV ? console : undefined
      }}
      onBeforeInit={(client) => client.setConsentDefaults(consentDefaults)}
    >
      <App />
    </GtmProvider>
  </React.StrictMode>
);
