// validate-workflow.js – vRO‑specific validator for variable naming & descriptions
// -----------------------------------------------------------------------------
//  • Scans every *.workflow.xml (pattern taken from env VRO_GLOB or fallback)
//  • Validates that input/output/attribute names follow naming conventions:
//      – lowerCamelCase  for normal variables/functions
//      – UPPER_CASE      for constants (heuristic: attribute read‑only="true")
//        If you use another rule to mark constants, adjust isConstant().
//  • Checks that every <workflow-item> has a non‑empty <description>.
//  • Reports all violations and exits with code 1 if any were found.
// -----------------------------------------------------------------------------

import fg from 'fast-glob';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';
const CAMEL_CASE_RE = /^[a-z][a-zA-Z0-9]*$/;
const UPPER_CASE_RE = /^[A-Z0-9_]+$/;

function isConstant(attr) {
  // Heuristic: treat attribute as constant if read‑only="true"
  return attr['read-only'] === 'true' || attr.readOnly === true;
}

function validateName(name, constant) {
  if (constant) return UPPER_CASE_RE.test(name);
  return CAMEL_CASE_RE.test(name);
}

function hasDescription(obj) {
  return obj.description?._?.trim().length > 0;
}

/* -------------------------  MAIN VALIDATION  ------------------------- */

let violations = 0;

const files = await fg(GLOB, { dot: true });
console.log(`🔍  Validating variables & descriptions: pattern = ${GLOB}`);
console.log(`    ➜  ${files.length} workflow file(s) found\n`);

for (const file of files) {
  const wfObj = await loadXml(file);
  const wf = wfObj.workflow;
  const fileRel = path.relative('.', file);

  // 1) Validate inputs, outputs, attributes
  const sections = [
    ...(wf.input?.param ?? []),
    ...(wf.output?.param ?? []),
    ...(wf.attrib ?? []),
  ];

  for (const entry of sections) {
    const name = entry.name;
    const constant = entry.type === 'const' || isConstant(entry);
    if (!validateName(name, constant)) {
      console.error(`${fileRel}: invalid name "${name}" (expected ${constant ? 'UPPER_CASE' : 'camelCase'})`);
      violations++;
    }
  }

  // 2) Validate each workflow‑item has description
  const items = wf['workflow-item'] ?? [];
  const arr = Array.isArray(items) ? items : [items];

  for (const item of arr) {
    if (!hasDescription(item)) {
      console.error(`${fileRel}: workflow-item "${item.name ?? item['display-name']?._ ?? 'unknown'}" is missing <description>`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n Validation failed with ${violations} violation(s).`);
  process.exit(1);
} else {
  console.log('All variables & descriptions are valid.');
}
