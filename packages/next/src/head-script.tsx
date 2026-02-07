import type React from 'react';
import { DEFAULT_DATA_LAYER_NAME } from '@jwiedeman/gtm-kit';
import type { ContainerConfigInput, ScriptAttributes } from '@jwiedeman/gtm-kit';
import { buildScriptUrl, DEFAULT_GTM_HOST, normalizeContainers } from './internal/container-helpers';

export interface GtmHeadScriptProps {
  containers: ContainerConfigInput | ContainerConfigInput[];
  host?: string;
  defaultQueryParams?: Record<string, string | number | boolean>;
  scriptAttributes?: ScriptAttributes;
  dataLayerName?: string;
}

const DEFAULT_ASYNC = true;

export const GtmHeadScript = ({
  containers,
  host = DEFAULT_GTM_HOST,
  defaultQueryParams,
  scriptAttributes,
  dataLayerName = DEFAULT_DATA_LAYER_NAME
}: GtmHeadScriptProps): React.ReactElement => {
  const normalized = normalizeContainers(containers);

  if (!normalized.length) {
    throw new Error('At least one GTM container is required to render script tags.');
  }

  return (
    <>
      {normalized.map((container) => {
        if (!container.id) {
          throw new Error('Container id is required to render GTM script tags.');
        }

        const params = {
          ...defaultQueryParams,
          ...container.queryParams
        };

        const src = buildScriptUrl(host, container.id, params, dataLayerName);
        const { async: asyncAttr, defer, nonce, ...restAttributes } = scriptAttributes ?? {};

        const scriptProps: React.ScriptHTMLAttributes<HTMLScriptElement> = {
          src,
          async: asyncAttr ?? DEFAULT_ASYNC
        };

        if (defer !== undefined) {
          scriptProps.defer = defer;
        }

        if (nonce) {
          scriptProps.nonce = nonce;
        }

        for (const [attribute, value] of Object.entries(restAttributes)) {
          if (value === undefined || value === null) {
            continue;
          }

          // Block src (already set) and event handler attributes to prevent XSS
          const lowerAttr = attribute.toLowerCase();
          if (lowerAttr === 'src' || lowerAttr.startsWith('on')) {
            continue;
          }

          (scriptProps as Record<string, unknown>)[attribute] = value;
        }

        return <script key={container.id} data-gtm-container-id={container.id} {...scriptProps} />;
      })}
    </>
  );
};
