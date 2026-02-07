import React from 'react';
import { createNoscriptMarkup, type ContainerConfigInput, type ContainerDescriptor } from '@jwiedeman/gtm-kit';

/**
 * Escape a string for safe use in JavaScript string literals.
 * Prevents XSS when interpolating user-provided values into inline scripts.
 */
function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Props for the GtmScripts component.
 */
export interface GtmScriptsProps {
  /**
   * GTM container ID(s).
   */
  containers: ContainerConfigInput | ContainerConfigInput[];

  /**
   * Custom GTM host URL.
   * @default 'https://www.googletagmanager.com'
   */
  host?: string;

  /**
   * Custom dataLayer name.
   * @default 'dataLayer'
   */
  dataLayerName?: string;

  /**
   * Script attributes (e.g., nonce for CSP).
   */
  scriptAttributes?: Record<string, string>;
}

/**
 * Normalize container config to array format.
 */
function normalizeContainers(containers: ContainerConfigInput | ContainerConfigInput[]): ContainerDescriptor[] {
  if (typeof containers === 'string') {
    return [{ id: containers }];
  }
  if (!Array.isArray(containers)) {
    return [containers];
  }
  return containers.map((c) => (typeof c === 'string' ? { id: c } : c));
}

/**
 * Server component that renders GTM script tags for Remix.
 * Use this in your root.tsx to add GTM scripts.
 *
 * @example
 * ```tsx
 * // app/root.tsx
 * import { GtmScripts } from '@jwiedeman/gtm-kit-remix';
 *
 * export default function App() {
 *   return (
 *     <html>
 *       <head>
 *         <GtmScripts containers="GTM-XXXXXX" />
 *       </head>
 *       <body>
 *         <Outlet />
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @example With CSP nonce
 * ```tsx
 * <GtmScripts
 *   containers="GTM-XXXXXX"
 *   scriptAttributes={{ nonce: 'your-csp-nonce' }}
 * />
 * ```
 */
/**
 * Build the GTM script URL for a container.
 */
function buildGtmScriptUrl(
  containerId: string,
  host: string,
  dataLayerName: string,
  queryParams?: Record<string, string | number | boolean>
): string {
  const normalizedHost = host.endsWith('/') ? host.slice(0, -1) : host;
  const params = new URLSearchParams();
  params.set('id', containerId);

  if (dataLayerName !== 'dataLayer') {
    params.set('l', dataLayerName);
  }

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'id' && key !== 'l') {
        params.set(key, String(value));
      }
    }
  }

  return `${normalizedHost}/gtm.js?${params.toString()}`;
}

export function GtmScripts({
  containers,
  host = 'https://www.googletagmanager.com',
  dataLayerName = 'dataLayer',
  scriptAttributes = {}
}: GtmScriptsProps): React.ReactElement {
  // Validate dataLayerName is a valid JavaScript identifier
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(dataLayerName)) {
    throw new Error(
      `[gtm-kit/remix] Invalid dataLayerName "${dataLayerName}". Must be a valid JavaScript identifier.`
    );
  }

  const containerConfigs = normalizeContainers(containers);

  // Filter out event handler attributes to prevent XSS
  const safeScriptAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(scriptAttributes)) {
    if (!key.toLowerCase().startsWith('on')) {
      safeScriptAttributes[key] = value;
    }
  }

  // Escape values for safe use in JavaScript string literals
  const safeDataLayerName = escapeJsString(dataLayerName);
  const safeNonce = safeScriptAttributes.nonce ? escapeJsString(safeScriptAttributes.nonce) : '';

  // Generate inline script for dataLayer initialization and GTM loading
  const inlineScript = `
    window['${safeDataLayerName}'] = window['${safeDataLayerName}'] || [];
    ${containerConfigs
      .map((config) => {
        const safeContainerId = escapeJsString(config.id);
        const scriptSrc = escapeJsString(buildGtmScriptUrl(config.id, host, dataLayerName, config.queryParams));
        return `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      '${scriptSrc}';${safeNonce ? `j.nonce='${safeNonce}';` : ''}f.parentNode.insertBefore(j,f);
      })(window,document,'script','${safeDataLayerName}','${safeContainerId}');
      `;
      })
      .join('\n')}
  `.trim();

  // Generate noscript HTML using the core package
  const noscriptHtml = createNoscriptMarkup(containerConfigs, { host });

  return (
    <>
      <script {...safeScriptAttributes} dangerouslySetInnerHTML={{ __html: inlineScript }} />
      <noscript dangerouslySetInnerHTML={{ __html: noscriptHtml }} />
    </>
  );
}
