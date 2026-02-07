import type React from 'react';
import { DEFAULT_DATA_LAYER_NAME } from '@jwiedeman/gtm-kit';
import type { ContainerConfigInput } from '@jwiedeman/gtm-kit';
import { DEFAULT_NOSCRIPT_IFRAME_ATTRIBUTES } from '@jwiedeman/gtm-kit';
import { buildNoscriptUrl, DEFAULT_GTM_HOST, normalizeContainers } from './internal/container-helpers';

export interface GtmNoScriptProps {
  containers: ContainerConfigInput | ContainerConfigInput[];
  host?: string;
  defaultQueryParams?: Record<string, string | number | boolean>;
  iframeAttributes?: Record<string, string | number | boolean>;
  dataLayerName?: string;
}

const toStringValue = (value: string | number | boolean): string => String(value);

const parseStyle = (style: string): React.CSSProperties => {
  return style
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<React.CSSProperties>((acc, declaration) => {
      const [property, rawValue] = declaration.split(':');
      if (!property || rawValue === undefined) {
        return acc;
      }

      const key = property.trim().replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      const value = rawValue.trim();
      if (!key || !value) {
        return acc;
      }

      (acc as Record<string, string>)[key] = value;
      return acc;
    }, {});
};

export const GtmNoScript = ({
  containers,
  host = DEFAULT_GTM_HOST,
  defaultQueryParams,
  iframeAttributes,
  dataLayerName = DEFAULT_DATA_LAYER_NAME
}: GtmNoScriptProps): React.ReactElement => {
  const normalized = normalizeContainers(containers);

  if (!normalized.length) {
    throw new Error('At least one GTM container is required to render noscript markup.');
  }

  return (
    <>
      {normalized.map((container) => {
        if (!container.id) {
          throw new Error('Container id is required to render GTM noscript markup.');
        }

        const params = {
          ...defaultQueryParams,
          ...container.queryParams
        };

        const src = buildNoscriptUrl(host, container.id, params, dataLayerName);
        const attributes = {
          ...DEFAULT_NOSCRIPT_IFRAME_ATTRIBUTES,
          ...iframeAttributes
        };

        const iframeProps: React.IframeHTMLAttributes<HTMLIFrameElement> = {
          src
        };

        for (const [attribute, value] of Object.entries(attributes)) {
          if (attribute === 'src') {
            continue;
          }

          if (value === undefined || value === null) {
            continue;
          }

          // Block event handler attributes to prevent XSS
          if (attribute.toLowerCase().startsWith('on')) {
            continue;
          }

          if (attribute === 'style') {
            if (typeof value === 'string') {
              iframeProps.style = parseStyle(value);
            } else if (typeof value === 'object') {
              iframeProps.style = value as React.CSSProperties;
            }
            continue;
          }

          (iframeProps as Record<string, unknown>)[attribute] = toStringValue(value as string | number | boolean);
        }

        return (
          <noscript key={container.id}>
            <iframe {...iframeProps} />
          </noscript>
        );
      })}
    </>
  );
};
