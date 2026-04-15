import { defineConfig } from 'tsup';
import baseConfig from '../../config/tsup.base';

export default defineConfig((options) => ({
  ...baseConfig,
  dts: true,
  clean: !options.watch,
  entry: ['src/index.ts', 'src/inspector.ts']
}));
