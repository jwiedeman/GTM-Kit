import { defineConfig } from 'tsup';
import baseConfig from '../../config/tsup.base';

// Note: We don't add a top-level 'use client' banner because this package's
// surface mixes Server Components (<GtmHeadScript>, <GtmNoScript>) with client
// hooks (useTrackPageViews, GtmErrorBoundary). Per-source 'use client' directives
// in the client files don't survive esbuild bundling, so consumers must mark
// their own files 'use client' when importing the client APIs (which they do
// anyway in App Router).
export default defineConfig((options) => ({
  ...baseConfig,
  clean: !options.watch,
  entry: ['src/index.ts']
}));
