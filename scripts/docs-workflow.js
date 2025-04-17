// docs-workflow.js — generate Markdown docs purely from XML + local form JSON
// -----------------------------------------------------------------------------
import fg from 'fast-glob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

// ENV override (optional)
const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';
const OUT_DIR = 'docs/workflows';

await fs.mkdir(OUT_DIR, { recursive: true });

const collect = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const fence = (code, lang = 'javascript') => `\`\`\`${lang}\n${code}\n\`\`\``;
const txt = (node) => (typeof node === 'string' ? node : node?._ ?? '');

// small util to build markdown tables
function table(arr, cols) {
  if (!arr.length) return '';
  const header =
    `| ${cols.map((c) => c.header).join(' | ')} |\n` +
    `|${'-|'.repeat(cols.length)}\n`;
  const rows = arr
    .map((row) => `| ${cols.map((c) => row[c.key] ?? '').join(' | ')} |`)
    .join('\n');
  return header + rows + '\n';
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
const files = await fg(GLOB, { dot: true });
console.log(`📝  Generating docs for ${files.length} workflow(s)\n`);

for (const xmlFile of files) {
  // ---------- parse XML ------------------------------------------------------
  const wfObj = await loadXml(xmlFile);
  const root = wfObj[Object.keys(wfObj)[0]]; // handle namespace prefix

  const wfName =
    root['display-name']?._ ?? root['object-name'] ?? path.basename(xmlFile);
  const wfId = root.id ?? 'n/a';
  const wfVersion = root.version ?? 'n/a';
  const wfDesc =
    root.description?._ ?? root.description ?? '_No description provided_';

  const attribs = collect(root.attrib);
  const inputs = collect(root.input?.param);
  const outputs = collect(root.output?.param);
  const items = collect(root['workflow-item']);
  const errorHandlers = collect(root['error-handler']);

  // gather linked modules / wf
  const linkedWorkflows = [];
  const linkedModules = [];
  for (const el of items) {
    if (el.type === 'link' && el['linked-workflow-id']) {
      linkedWorkflows.push({
        id: el['linked-workflow-id'],
        name: txt(el['display-name']) || el.name,
      });
    }
    if (el['script-module']) linkedModules.push(el['script-module']);
  }

  // ---------- parse FORM JSON ----------------------------------------------
  let formProps = [];
  const formDir = path.join(path.dirname(xmlFile), 'forms');
  try {
    const formJsonRaw = await fs.readFile(path.join(formDir, '_.json'), 'utf8');
    const formJson = JSON.parse(formJsonRaw);
    const schema = formJson.schema ?? {};
    formProps = Object.values(schema).map((p) => ({
      id: p.id,
      label: p.label,
      dataType: p.type?.dataType ?? '',
      constraints: JSON.stringify(p.constraints ?? {}),
      default: JSON.stringify(p.default ?? {}),
      valueList: JSON.stringify(p.valueList ?? {}),
      signpost: p.signpost ?? '',
    }));
  } catch {
    // no forms folder or _.json -> ignore
  }

  // ---------- build markdown -------------------------------------------------
  let md = `# ${wfName} - Workflow Documentation\n\n`;

  // details
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

  // elements
  md += `<details>\n<summary><h2>Workflow Elements</h2></summary>\n\n`;
  for (const el of items) {
    const elName = txt(el['display-name']) || el.name || 'unknown';
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

    if (el.script?._)
      md += `\n**Script:**\n\n${fence(el.script._.trim())}\n`;

    md += '\n---\n\n';
  }
  md += `</details>\n\n`;

  // error handlers
  md += `<details>\n<summary><h2>Error Handlers</h2></summary>\n\n`;
  if (errorHandlers.length) {
    for (const eh of errorHandlers)
      md += `- **Element Name:** ${eh.name} (throws: ${eh['throw-bind-name'] ?? '_None_'})\n`;
  } else md += '_No error handlers defined._\n';
  md += `</details>\n\n`;

  // linked
  md += `<details>\n<summary><h2>Linked Workflows</h2></summary>\n\n`;
  if (linkedWorkflows.length)
    linkedWorkflows.forEach((lw) =>
      (md += `- **Name:** ${lw.name}, **ID:** \`${lw.id}\`\n`));
  else md += '_No linked workflows defined._\n';
  md += `</details>\n\n`;

  if (linkedModules.length) {
    md += `<details>\n<summary><h2>Linked Actions (script modules)</h2></summary>\n\n`;
    linkedModules.forEach((m) => (md += `- \`${m}\`\n`));
    md += `</details>\n\n`;
  }

  // ---------- write file -----------------------------------------------------
  const outPath = path.join(
    OUT_DIR,
    `${wfName.replace(/\\s+/g, '_')}.md`
  );
  await fs.writeFile(outPath, md, 'utf8');
  console.log(`✔  ${outPath}`);
}

console.log('\\n✅  Documentation generated (XML + local form JSON)');
