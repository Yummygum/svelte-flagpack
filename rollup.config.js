import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import svg from 'rollup-plugin-svg';
import common from '@rollup/plugin-commonjs';
import { sass } from 'svelte-preprocess-sass';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import minify from 'rollup-plugin-babel-minify'
import replace from 'rollup-plugin-replace'

const pkg = require('./package.json');

const dev = 'development'
const prod = 'production'
const env = (process.env.NODE_ENV === prod || process.env.NODE_ENV === dev) ? process.env.NODE_ENV : dev

const plugins = [
  svelte({
      emitCss: false,
      preprocess: {
        style: sass(),
      },
    }),
  replace({'process.env.NODE_ENV': JSON.stringify(env)}),
  svg({base64: true}),
  dynamicImportVars(),
  resolve(),
  common()
]

export default {
  input: 'src/Flag.svelte',
  output: [
    { file: pkg.module, 'format': 'es', inlineDynamicImports: true },
    { file: pkg.main, 'format': 'umd', name: 'Flag', inlineDynamicImports: true },

  ],
  plugins
};


if (env === prod) {
  plugins.push(minify())
}
