#!/usr/bin/env node
import { ESLint } from 'eslint';
import { loadXml, extractScripts } from './parse-vro.js';
import { promises as fs } from 'node:fs';
import glob from 'fast-glob';

const files = await glob('vro-samples/**/*.xml');
const eslint = new ESLint();

let hasError = false;

for (const file of files) {
  const wf = await loadXml(file);
  const scripts = extractScripts(wf);

  for (const { name, code } of scripts) {
    const results = await eslint.lintText(code, { filePath: `${file}#${name}.js` });
    const formatter = await eslint.loadFormatter('stylish');
    const output = formatter.format(results);
    if (output) console.log(output);
    hasError ||= results.some((r) => r.errorCount > 0);
  }
}

if (hasError) {
  console.error('✖ ESLint errors found');
  process.exit(1);
} else {
  console.log('✔ All embedded scripts pass ESLint');
}
