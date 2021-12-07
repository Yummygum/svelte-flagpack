import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import svg from 'rollup-plugin-svg';
import common from '@rollup/plugin-commonjs';
import { sass } from 'svelte-preprocess-sass';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import minify from 'rollup-plugin-babel-minify'
import replace from 'rollup-plugin-replace'
import copy from 'rollup-plugin-copy'

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
    compilerOptions: {

      // By default, the client-side compiler is used. You
      // can also use the server-side rendering compiler
      generate: 'ssr',

      // ensure that extra attributes are added to head
      // elements for hydration (used with generate: 'ssr')
      hydratable: true,

      // You can optionally set 'customElement' to 'true' to compile
      // your components to custom elements (aka web elements)
      customElement: false
    }
  }),
  replace({'process.env.NODE_ENV': JSON.stringify(env)}),
  svg({base64: true}),
  dynamicImportVars(),
  resolve(),
  common(),
  copy({
    targets: [
      { src: 'src/Flag.svelte', dest: 'dist/' }
    ]
  })
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
