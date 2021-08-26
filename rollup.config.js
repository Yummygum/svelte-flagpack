import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import svg from 'rollup-plugin-svg';
import common from '@rollup/plugin-commonjs';
import { sass } from 'svelte-preprocess-sass';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

const pkg = require('./package.json');

export default {
  input: 'src/Flag.svelte',
  output: [
    { file: pkg.module, 'format': 'es', inlineDynamicImports: true },
    { file: pkg.main, 'format': 'umd', name: 'Flag', inlineDynamicImports: true },

  ],
  plugins: [
    svelte({
      emitCss: false,
      preprocess: {
        style: sass(),
      },
    }),
    svg({base64: true}),
    dynamicImportVars(),
    resolve(),
    common()
  ],
};
