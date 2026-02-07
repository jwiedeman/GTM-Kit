import { push } from './client';

// No-op function for SSR/cleanup returns
const noop = (): void => {
  /* no-op */
};

export interface PageViewData {
  event?: string;
  page_path?: string;
  page_location?: string;
  page_title?: string;
  page_referrer?: string;
  [key: string]: unknown;
}

export interface TrackPageViewOptions {
  /**
   * The event name to use for page views.
   * @default 'page_view'
   */
  eventName?: string;

  /**
   * Whether to include query parameters in the page path.
   * @default true
   */
  includeQueryParams?: boolean;

  /**
   * Additional data to include with each page view.
   */
  additionalData?: Record<string, unknown> | (() => Record<string, unknown>);
}

const getAdditionalData = (additionalData: TrackPageViewOptions['additionalData']): Record<string, unknown> => {
  if (typeof additionalData === 'function') {
    return additionalData();
  }
  return additionalData ?? {};
};

/**
 * Track a page view event.
 *
 * @example
 * ```ts
 * import { trackPageView } from '@jwiedeman/gtm-kit-astro';
 *
 * // Track current page
 * trackPageView();
 *
 * // Track with custom data
 * trackPageView({
 *   additionalData: { user_type: 'guest' }
 * });
 * ```
 */
export const trackPageView = (options: TrackPageViewOptions = {}): void => {
  const { eventName = 'page_view', includeQueryParams = true, additionalData } = options;

  if (typeof window === 'undefined') {
    return;
  }

  const pagePath = includeQueryParams ? window.location.pathname + window.location.search : window.location.pathname;

  const pageViewData: PageViewData = {
    event: eventName,
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
    ...getAdditionalData(additionalData)
  };

  push(pageViewData);
};

let viewTransitionsSetup = false;
let pageTrackingSetup = false;
let lastTrackedPath = '';

/**
 * Reset page tracking state (for testing only).
 * @internal
 */
export const _resetPageTrackingState = (): void => {
  viewTransitionsSetup = false;
  pageTrackingSetup = false;
  lastTrackedPath = '';
};

/**
 * Set up automatic page view tracking with Astro View Transitions.
 * Call this once when the page loads.
 *
 * @example
 * ```astro
 * ---
 * // src/layouts/Layout.astro
 * ---
 * <script>
 *   import { initGtm, setupViewTransitions } from '@jwiedeman/gtm-kit-astro';
 *
 *   initGtm({ containers: 'GTM-XXXXXX' });
 *   setupViewTransitions();
 * </script>
 * ```
 */
export const setupViewTransitions = (options: TrackPageViewOptions = {}): (() => void) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return noop;
  }

  // Prevent duplicate setup
  if (viewTransitionsSetup) {
    return noop;
  }

  viewTransitionsSetup = true;

  // Track initial page view
  lastTrackedPath = window.location.pathname + window.location.search;
  trackPageView(options);

  // Handle Astro View Transitions
  // The 'astro:page-load' event fires after every page load, including View Transitions
  const handlePageLoad = () => {
    const currentPath = window.location.pathname + window.location.search;

    // Avoid duplicate tracking for the same path
    if (currentPath === lastTrackedPath) {
      return;
    }

    lastTrackedPath = currentPath;
    trackPageView(options);
  };

  document.addEventListener('astro:page-load', handlePageLoad);

  // Cleanup function
  return () => {
    document.removeEventListener('astro:page-load', handlePageLoad);
    viewTransitionsSetup = false;
    lastTrackedPath = '';
  };
};

/**
 * Set up page view tracking for standard navigation (no View Transitions).
 * Tracks on popstate (back/forward) and initial load.
 *
 * @example
 * ```ts
 * import { setupPageTracking } from '@jwiedeman/gtm-kit-astro';
 *
 * setupPageTracking();
 * ```
 */
export const setupPageTracking = (options: TrackPageViewOptions = {}): (() => void) => {
  if (typeof window === 'undefined') {
    return noop;
  }

  // Prevent duplicate setup
  if (pageTrackingSetup) {
    return noop;
  }

  pageTrackingSetup = true;

  // Track initial page view
  lastTrackedPath = window.location.pathname + window.location.search;
  trackPageView(options);

  // Handle browser back/forward navigation
  const handlePopState = () => {
    const currentPath = window.location.pathname + window.location.search;

    if (currentPath === lastTrackedPath) {
      return;
    }

    lastTrackedPath = currentPath;
    trackPageView(options);
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
    pageTrackingSetup = false;
    lastTrackedPath = '';
  };
};
