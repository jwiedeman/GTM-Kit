'use client';

import { useTrackPageViews } from '@jwiedeman/gtm-kit-next';
import { pushEvent } from '@jwiedeman/gtm-kit';
import { useGtmClient } from '@jwiedeman/gtm-kit-react';

const buildPageViewPayload = ({ pagePath, url, title }: { pagePath: string; url: string; title?: string }) => ({
  page_path: pagePath,
  page_location: url,
  ...(title ? { page_title: title } : {})
});

export const GtmBridge = () => {
  const client = useGtmClient();

  useTrackPageViews({
    client,
    buildPayload: buildPageViewPayload,
    pushEventFn: pushEvent,
    includeSearchParams: true,
    trackHash: true
  });

  return null;
};
