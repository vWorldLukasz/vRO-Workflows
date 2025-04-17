// docs-workflow.js — generate Markdown docs from vRO XML + local form JSON
// -----------------------------------------------------------------------------
// Fix: correct handling of <display-name> so we never print [object Object]
// -----------------------------------------------------------------------------
import fg from 'fast-glob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';
const OUT_DIR = 'docs/workflows';
await fs.mkdir(OUT_DIR, { recursive: true });

const collect = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const fence = (code, lang = 'javascript') => `\`\`\`${lang}\n${code}\n\`\``;
const text = (node) => (typeof node === 'string' ? node : node?._ ?? '');

// -----------------------------------------------------------------------------
const files = await fg(GLOB, { dot: true });
console.log(`📝  Generating docs for ${files.length} workflow(s)\n`);

for (const xmlFile of files) {
  const wfObj = await loadXml(xmlFile);
  const root = wfObj[Object.keys(wfObj)[0]]; // namespace prefix safe

  // ---------- Metadata -----------------------------------------------------
  const wfName = text(root['display-name']) || root['object-name'] || path.basename(xmlFile);
  const wfId = root.id ?? 'n/a';
  const wfVersion = root.version ?? 'n/a';
  const wfDesc = text(root.description) || '_No description provided_';

  const attribs = collect(root.attrib);
  const inputs = collect(root.input?.param);
  const outputs = collect(root.output?.param);
  const items = collect(root['workflow-item']);
  const errorHandlers = collect(root['error-handler']);

  // ---------- Linked items -------------------------------------------------
  const linkedWorkflows = [];
  const linkedModules = [];
  for (const el of items) {
    const dispName = text(el['display-name']) || el.name || 'unknown';
    if (el.type === 'link' && el['linked-workflow-id']) {
      linkedWorkflows.push({ id: el['linked-workflow-id'], name: dispName });
    }
    if (el['script-module']) linkedModules.push(el['script-module']);
  }

  // ---------- Forms --------------------------------------------------------
  let formProps = [];
  const formFolder = path.join(path.dirname(xmlFile), 'forms');
  try {
    const formRaw = await fs.readFile(path.join(formFolder, '_.json'), 'utf8');
    const schema = JSON.parse(formRaw).schema ?? {};
    formProps = Object.values(schema).map((p) => ({
      id: p.id,
      label: p.label,
      dataType: p.type?.dataType ?? '',
      constraints: JSON.stringify(p.constraints ?? {}),
      default: JSON.stringify(p.default ?? {}),
      valueList: JSON.stringify(p.valueList ?? {}),
      signpost: p.signpost ?? '',
    }));
  } catch {/* no form */}

  // ---------- Helpers ------------------------------------------------------
  const table = (arr, cols) =>
    arr.length
      ? `| ${cols.map((c) => c.header).join(' | ')} |\n|${'-|'.repeat(cols.length)}\n` +
        arr
          .map((r) => `| ${cols.map((c) => r[c.key] ?? '').join(' | ')} |`)
          .join('\n') +
        '\n'
      : '';

  // ---------- Markdown -----------------------------------------------------
  let md = `# ${wfName} - Workflow Documentation\n\n`;
  md += `<details>\n<summary><h2>Workflow Details</h2></summary>\n\n`;
  md += `- **Workflow Name:** ${wfName}\n`;
  md += `- **Workflow ID:** \`${wfId}\`\n`;
  md += `- **Version:** ${wfVersion}\n`;
  md += `- **Description:** ${wfDesc}\n`;
  md += `</details>\n\n`;

  if (attribs.length)
    md += `<details>\n<summary><h2>Workflow Variables</h2></summary>\n\n` +
      table(attribs, [
        { key: 'name', header: 'Name' },
        { key: 'type', header: 'Type' },
      ]) +
      `</details>\n\n`;
  if (inputs.length)
    md += `<details>\n<summary><h2>Workflow Inputs</h2></summary>\n\n` +
      table(inputs, [
        { key: 'name', header: 'Name' },
        { key: 'type', header: 'Type' },
      ]) +
      `</details>\n\n`;
  if (outputs.length)
    md += `<details>\n<summary><h2>Workflow Outputs</h2></summary>\n\n` +
      table(outputs, [
        { key: 'name', header: 'Name' },
        { key: 'type', header: 'Type' },
      ]) +
      `</details>\n\n`;
  if (formProps.length)
    md += `<details>\n<summary><h2>Workflow Form</h2></summary>\n\n` +
      table(formProps, [
        { key: 'id', header: 'ID' },
        { key: 'label', header: 'Label' },
        { key: 'dataType', header: 'Data Type' },
        { key: 'constraints', header: 'Constraints' },
        { key: 'default', header: 'Default' },
        { key: 'valueList', header: 'Value List' },
        { key: 'signpost', header: 'Signpost' },
      ]) +
      `</details>\n\n`;

  md += `<details>\n<summary><h2>Workflow Elements</h2></summary>\n\n`;
  for (const el of items) {
    const elName = text(el['display-name']) || el.name || 'unknown';
    md += `#### Element: ${elName}\n`;
    md += `- **Type:** ${el.type}\n`;
    md += `- **Description:** ${el.description ?? '_No description provided_'}\n`;

    const inB = collect(el['in-binding']?.bind);
    if (inB.length)
      md += `\n**Input Bindings:**\n\n` +
        table(inB, [
          { key: 'name', header: 'Variable Name' },
          { key: 'type', header: 'Type' },
          { key: 'export-name', header: 'Workflow Variable' },
        ]);

    const outB = collect(el['out-binding']?.bind);
    if (outB.length)
      md += `\n**Output Bindings:**\n\n` +
        table(outB, [
          { key: 'name', header: 'Variable Name' },
          { key: 'type', header: 'Type' },
          { key: 'export-name', header: 'Workflow Variable' },
        ]);

    if (el.script?._) md += `\n**Script:**\n\n${fence(el.script._.trim())}\n`;
    md += '\n---\n\n';
  }
  md += `</details>\n\n`;

  md += `<details>\n<summary><h2>Error Handlers</h2></summary>\n\n`;
  if (errorHandlers.length)
    errorHandlers.forEach((eh) =>
      (md += `- **Element Name:** ${eh.name} (throws: ${eh['throw-bind-name'] ?? '_None_'})\n`));
  else md += '_No error handlers defined._\n';
  md += `</details>\n\n`;

  md += `<details>\n<summary><h2>Linked Workflows</h2></summary>\n\n`;
  if (linkedWorkflows.length)
    linkedWorkflows.forEach((lw) =>
      (md += `- **Name:** ${lw.name}, **ID:** \`${lw.id}\`\n`));
  else md += '_No linked workflows defined._\n';
  md += `</details>\n\n`;

  if (linkedModules.length) {
    md += `<details>\n<summary><h2>Linked Actions (script modules)</h2></summary>\n\n`;
    linkedModules.forEach((m) => (md += `- \`${m}\`\n`));
    md += '</details>\n\n';
  }

  const out = path.join(OUT_DIR, `${wfName.replace(/\s+/g, '_')}.md`);
  await fs.writeFile(out, md, 'utf8');
  console.log(`✔  ${out}`);
}

console.log('\n✅  Documentation generated (XML + forms)');
