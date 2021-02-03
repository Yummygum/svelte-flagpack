import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import svg from 'rollup-plugin-svg'
import common from '@rollup/plugin-commonjs'

const pkg = require('./package.json');

export default {
  input: 'src/Flag.svelte',
  output: [
    { file: pkg.module, 'format': 'es' },
    { file: pkg.main, 'format': 'umd', name: 'Flag' }
  ],
  plugins: [
    svelte(),
    svg(),
    resolve(),
    common()
  ],
};
