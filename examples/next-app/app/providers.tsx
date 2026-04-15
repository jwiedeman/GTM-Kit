'use client';

import type { ReactNode } from 'react';
import { Suspense, useCallback } from 'react';
import { GtmProvider } from '@jwiedeman/gtm-kit-react';
import type { GtmClient } from '@jwiedeman/gtm-kit';

import { GTM_CONTAINERS } from '../lib/gtm';
import { GtmBridge } from '../components/gtm-bridge';
import { getInitialConsent } from '../lib/consent-cookie';
import { DEFAULT_CONSENT } from '../lib/gtm';

export interface AppProvidersProps {
  children: ReactNode;
  nonce?: string;
}

export const AppProviders = ({ children, nonce }: AppProvidersProps) => {
  const onBeforeInit = useCallback((client: GtmClient) => {
    const consent = typeof document !== 'undefined' ? getInitialConsent(document.cookie ?? null) : DEFAULT_CONSENT;
    client.setConsentDefaults(consent);
  }, []);

  return (
    <GtmProvider
      config={{
        containers: GTM_CONTAINERS,
        dataLayerName: 'nextAppDataLayer',
        scriptAttributes: nonce ? { nonce } : undefined
      }}
      onBeforeInit={onBeforeInit}
    >
      <Suspense fallback={null}>
        <GtmBridge />
      </Suspense>
      {children}
    </GtmProvider>
  );
};
