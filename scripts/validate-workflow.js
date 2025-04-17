// validate-workflow.js – vRO‑specific validator for variable naming & descriptions
// -----------------------------------------------------------------------------
// • Scans every *.workflow.xml (pattern from env VRO_GLOB or fallback)
// • Validates that input/output/attribute names follow naming conventions:
//     – lowerCamelCase  for normal variables/functions
//     – UPPER_CASE      for constants (heuristic: attribute read‑only="true")
// • Checks that every <workflow-item> has a non‑empty <description>.
// • Reports all violations and exits with code 1 if any were found.
// -----------------------------------------------------------------------------

import fg from 'fast-glob';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';

// RegEx helpers
const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;
const UPPER_CASE_RE = /^[A-Z0-9_]+$/;

function isConstant(attr) {
  // Heuristic: treat attribute as constant if marked read‑only="true"
  return (
    attr['read-only'] === 'true' ||
    attr.readOnly === true ||
    attr['readOnly'] === 'true'
  );
}

function validateName(name, constant) {
  return constant ? UPPER_CASE_RE.test(name) : CAMEL_CASE_RE.test(name);
}

function hasDescription(item) {
  if (!item || !item.description) return false;
  const text = item.description._ ?? item.description;
  return typeof text === 'string' && text.trim().length > 0;
}

/* -------------------------  MAIN VALIDATION  ------------------------- */

let violations = 0;

const files = await fg(GLOB, { dot: true });
console.log(`🔍  Validating variables & descriptions: pattern = ${GLOB}`);
console.log(`    ➜  ${files.length} workflow file(s) found\n`);

for (const file of files) {
  const wfObj = await loadXml(file);

  // Handle namespaced root (<workflow xmlns="…">)
  const rootKey = Object.keys(wfObj)[0];
  const wf = wfObj[rootKey];

  if (!wf) {
    console.error(`${file}: cannot find <workflow> root element`);
    violations++;
    continue;
  }

  const fileRel = path.relative('.', file);

  /* ------------ Validate variable naming ------------ */
  const inputs = Array.isArray(wf.input?.param)
    ? wf.input.param
    : wf.input?.param
    ? [wf.input.param]
    : [];
  const outputs = Array.isArray(wf.output?.param)
    ? wf.output.param
    : wf.output?.param
    ? [wf.output.param]
    : [];
  const attribs = Array.isArray(wf.attrib) ? wf.attrib : wf.attrib ? [wf.attrib] : [];

  const sections = [...inputs, ...outputs, ...attribs];

  for (const entry of sections) {
    const name = entry?.name;
    if (!name) continue;
    const constant = isConstant(entry);
    if (!validateName(name, constant)) {
      console.error(
        `${fileRel}: variable "${name}" violates naming convention (expected ${
          constant ? 'UPPER_CASE' : 'camelCase'
        })`
      );
      violations++;
    }
  }

  /* ------------ Validate descriptions ------------ */
  const itemsRaw = wf['workflow-item'] ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

  for (const item of items) {
    if (!hasDescription(item)) {
      const label = item['display-name']?._ ?? item.name ?? 'unknown';
      console.error(`${fileRel}: workflow-item "${label}" is missing <description>`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n❌  Validation failed with ${violations} violation(s).`);
  process.exit(1);
} else {
  console.log('✅  All variables & descriptions are valid.');
}
