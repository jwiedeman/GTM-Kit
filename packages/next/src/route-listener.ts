'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { GtmClient, PageViewPayload, ScriptLoadState } from '@jwiedeman/gtm-kit';
import { pushEvent } from '@jwiedeman/gtm-kit';

const DEFAULT_EVENT_NAME = 'page_view';

export interface RouteLocationSnapshot {
  pathname: string;
  search: string;
  hash: string;
  pagePath: string;
  url: string;
}

export interface RouteChangeEventDetails extends RouteLocationSnapshot {
  title?: string;
  previous?: RouteLocationSnapshot;
}

export type PageViewPayloadBuilder = (details: RouteChangeEventDetails) => PageViewPayload;

export interface UseTrackPageViewsOptions {
  client: Pick<GtmClient, 'push' | 'whenReady'>;
  eventName?: string;
  buildPayload?: PageViewPayloadBuilder;
  includeSearchParams?: boolean;
  trackHash?: boolean;
  trackOnMount?: boolean;
  skipSamePath?: boolean;
  pushEventFn?: typeof pushEvent;
  waitForReady?: boolean;
  readyPromise?: Promise<ScriptLoadState[]>;
}

interface RouteSnapshot extends RouteLocationSnapshot {
  key: string;
}

const defaultBuildPayload: PageViewPayloadBuilder = ({ pagePath, url, title }) => {
  const payload: PageViewPayload = {
    page_path: pagePath,
    page_location: url
  };

  if (title) {
    payload.page_title = title;
  }

  return payload;
};

const buildUrl = (pagePath: string, hash: string): string => {
  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  if (!origin) {
    return `${pagePath}${hash}`;
  }

  return `${origin}${pagePath}${hash}`;
};

const sanitizeHash = (hash: string): string => (hash && hash.startsWith('#') ? hash : hash ? `#${hash}` : '');

export const useTrackPageViews = ({
  client,
  eventName = DEFAULT_EVENT_NAME,
  buildPayload = defaultBuildPayload,
  includeSearchParams = true,
  trackHash = false,
  trackOnMount = true,
  skipSamePath = true,
  pushEventFn = pushEvent,
  waitForReady = false,
  readyPromise
}: UseTrackPageViewsOptions): void => {
  if (!client) {
    throw new Error('A GTM client is required to track page views.');
  }

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = useMemo(() => {
    if (!includeSearchParams || !searchParams) {
      return '';
    }

    return searchParams.toString();
  }, [includeSearchParams, searchParams]);

  const previousRef = useRef<RouteSnapshot | null>(null);
  const hasTrackedRef = useRef(false);
  const pendingKeyRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Compute readiness promise inline to avoid stale ref from separate useEffect
  const readinessPromise = waitForReady ? (readyPromise ?? client.whenReady()) : null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const logFailures = useCallback((states: ScriptLoadState[]) => {
    const failed = states.filter((state) => state.status === 'failed');
    if (!failed.length) {
      return;
    }

    const details = failed.map((state) => state.containerId).join(', ');
    // eslint-disable-next-line no-console
    console.error(`[gtm-kit/next] Failed to load GTM container script(s): ${details}`, failed);
  }, []);

  const handleRouteChange = useCallback(
    (nextPathname: string | null, searchValue: string, rawHash: string) => {
      if (!nextPathname) {
        return;
      }

      const normalizedHash = trackHash ? sanitizeHash(rawHash) : '';
      const pagePath = searchValue ? `${nextPathname}?${searchValue}` : nextPathname;
      const key = `${pagePath}${normalizedHash}`;
      const url = buildUrl(pagePath, normalizedHash);

      if (!trackOnMount && !hasTrackedRef.current) {
        previousRef.current = {
          key,
          pathname: nextPathname,
          search: searchValue,
          hash: normalizedHash,
          pagePath,
          url
        };
        hasTrackedRef.current = true;
        return;
      }

      if (skipSamePath && previousRef.current && previousRef.current.key === key) {
        return;
      }

      const title = typeof document !== 'undefined' ? document.title : undefined;
      const previous = previousRef.current
        ? {
            pathname: previousRef.current.pathname,
            search: previousRef.current.search,
            hash: previousRef.current.hash,
            pagePath: previousRef.current.pagePath,
            url: previousRef.current.url
          }
        : undefined;

      const details: RouteChangeEventDetails = {
        pathname: nextPathname,
        search: searchValue,
        hash: normalizedHash,
        pagePath,
        url,
        title,
        previous
      };

      const pushPayload = (): void => {
        const payload = buildPayload(details);
        pushEventFn(client, eventName, payload);

        previousRef.current = {
          key,
          pathname: nextPathname,
          search: searchValue,
          hash: normalizedHash,
          pagePath,
          url
        };
        hasTrackedRef.current = true;
      };

      if (waitForReady && readinessPromise) {
        pendingKeyRef.current = key;
        readinessPromise
          .then((states) => {
            if (!isMountedRef.current || pendingKeyRef.current !== key) {
              return;
            }

            logFailures(states);
            pushPayload();
          })
          .catch((error) => {
            if (!isMountedRef.current || pendingKeyRef.current !== key) {
              return;
            }
            // eslint-disable-next-line no-console
            console.error('[gtm-kit/next] Error while waiting for GTM readiness.', error);
            pushPayload();
          });

        return;
      }

      pushPayload();
    },
    [buildPayload, client, eventName, logFailures, pushEventFn, readinessPromise, skipSamePath, trackHash, trackOnMount, waitForReady]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = trackHash ? (window.location.hash ?? '') : '';
    handleRouteChange(pathname, search, hash);
  }, [handleRouteChange, pathname, search, trackHash]);

  useEffect(() => {
    if (!trackHash || typeof window === 'undefined') {
      return;
    }

    const listener = (): void => {
      handleRouteChange(pathname, search, window.location.hash ?? '');
    };

    window.addEventListener('hashchange', listener);
    return () => {
      window.removeEventListener('hashchange', listener);
    };
  }, [handleRouteChange, pathname, search, trackHash]);
};
