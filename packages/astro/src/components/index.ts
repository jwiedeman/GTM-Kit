export {
  generateScriptTags,
  generateNoscriptTags,
  generateDataLayerScript,
  generateGtmScript,
  DEFAULT_GTM_HOST
} from './helpers';

// Re-export URL utilities from core for backwards compatibility
export {
  normalizeContainers,
  normalizeContainer,
  buildGtmScriptUrl as buildScriptUrl,
  buildGtmNoscriptUrl as buildNoscriptUrl
} from '@jwiedeman/gtm-kit';

export type { GtmScriptConfig, ScriptTagData, NoscriptTagData } from './helpers';
