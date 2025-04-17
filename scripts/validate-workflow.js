// validate-workflow.js – vRO‑specific validator for variable naming & descriptions
// -----------------------------------------------------------------------------
// • Scans every *.workflow.xml (pattern from env VRO_GLOB or fallback)
// • Validates that input/output/attribute names follow naming conventions:
//     – lowerCamelCase  for regular variables / functions
//     – UPPER_CASE      for constants (heuristic: attribute read‑only="true")
// • Checks that every <workflow-item> (except start/end/link) has a non‑empty <description>.
// • Checks that every <input>/<output>/<attrib> has a non‑empty <description> child.
// • Reports all violations and exits with code 1 if any were found.
// -----------------------------------------------------------------------------

import fg from 'fast-glob';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';

// RegEx helpers
// CamelCase must start with a lowercase letter and include at least one capital
const CAMEL_CASE_RE = /^[a-z]+(?:[A-Z][a-z0-9]*)*$/;
const UPPER_CASE_RE = /^[A-Z0-9_]+$/;

function isConstant(attr) {
  // heuristics: treat attribute as constant if read‑only="true"
  return (
    attr['read-only'] === 'true' ||
    attr.readOnly === true ||
    attr['readOnly'] === 'true'
  );
}

function validateName(name, constant) {
  return constant ? UPPER_CASE_RE.test(name) : CAMEL_CASE_RE.test(name);
}

function nodeHasDescription(node) {
  if (!node || !node.description) return false;
  const text = node.description._ ?? node.description;
  return typeof text === 'string' && text.trim().length > 0;
}

/* -----------------------------  MAIN  ----------------------------- */

let violations = 0;
const files = await fg(GLOB, { dot: true });
console.log(`🔍  Validating variables & descriptions: pattern = ${GLOB}`);
console.log(`    ➜  ${files.length} workflow file(s) found\n`);

for (const file of files) {
  const wfObj = await loadXml(file);
  const rootKey = Object.keys(wfObj)[0]; // handle namespace prefixes
  const wf = wfObj[rootKey];

  if (!wf) {
    console.error(`${file}: cannot find <workflow> root element`);
    violations++;
    continue;
  }

  const fileRel = path.relative('.', file);

  /* -------- 1. Validate input/output/attrib naming + description -------- */
  const collect = (node) =>
    Array.isArray(node) ? node : node ? [node] : [];

  const inputs = collect(wf.input?.param);
  const outputs = collect(wf.output?.param);
  const attribs = collect(wf.attrib);

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

    if (!nodeHasDescription(entry)) {
      console.error(`${fileRel}: variable "${name}" is missing <description>`);
      violations++;
    }
  }

  /* -------- 2. Validate workflow‑item descriptions -------- */
  const itemsRaw = wf['workflow-item'] ?? [];
  const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

  for (const item of items) {
    const type = item.type ?? item["type"];
    if (type === 'end' || type === 'start' || type === 'link') continue; // skip technical nodes

    if (!nodeHasDescription(item)) {
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
