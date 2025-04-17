// docs-workflow.js – generate detailed Markdown documentation for vRO workflow XML
// --------------------------------------------------------------------------------
// Usage: node scripts/docs-workflow.js
//  • Searches for *.workflow.xml files (override via VRO_GLOB env variable)
//  • Generates a Markdown doc per workflow in docs/workflows/<file>.md
//  • Structure matches internal guide (details/summary sections, tables, code)
// --------------------------------------------------------------------------------

import fg from 'fast-glob';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadXml } from './parse-vro.js';

const GLOB = process.env.VRO_GLOB || '**/*workflow.xml';
const OUT_DIR = 'docs/workflows';
await fs.mkdir(OUT_DIR, { recursive: true });

const collect = (node) => (Array.isArray(node) ? node : node ? [node] : []);

const files = await fg(GLOB, { dot: true });
console.log(`📝  Generating docs for ${files.length} workflow(s)\n`);

for (const file of files) {
  const wfObj = await loadXml(file);
  const rootKey = Object.keys(wfObj)[0];
  const wf = wfObj[rootKey];
  const wfName = wf['display-name']?._ ?? wf['object-name'] ?? path.basename(file);
  const wfId = wf.id ?? 'n/a';
  const wfDesc = wf.description?._ ?? wf.description ?? '_No description provided_';

  const attribs = collect(wf.attrib);
  const inputs = collect(wf.input?.param);
  const outputs = collect(wf.output?.param);
  const formProps = collect(wf.schema); // placeholder if forms are stored elsewhere

  // Build markdown -----------------------------------------------------------
  let md = `# ${wfName} - Workflow Documentation\n\n`;

  // details: Workflow
  md += `<details>\n<summary><h2>Workflow Details</h2></summary>\n\n`;
  md += `- **Workflow Name:** ${wfName}\n`;
  md += `- **Workflow ID:** \`${wfId}\`\n`;
  md += `- **Description:** ${wfDesc}\n`;
  md += `</details>\n\n`;

  // helper to table rows
  const toTable = (arr) =>
    arr.map((o) => `| ${o.name ?? o.id ?? ''} | ${o.type ?? o.dataType ?? ''} |`).join('\n');

  if (attribs.length) {
    md += `<details>\n<summary><h2>Workflow Variables</h2></summary>\n\n`;
    md += `| Name | Type |\n|------|------|\n` + toTable(attribs) + '\n';
    md += `</details>\n\n`;
  }
  if (inputs.length) {
    md += `<details>\n<summary><h2>Workflow Inputs</h2></summary>\n\n`;
    md += `| Name | Type |\n|------|------|\n` + toTable(inputs) + '\n';
    md += `</details>\n\n`;
  }
  if (outputs.length) {
    md += `<details>\n<summary><h2>Workflow Outputs</h2></summary>\n\n`;
    md += `| Name | Type |\n|------|------|\n` + toTable(outputs) + '\n';
    md += `</details>\n\n`;
  }

  // schema items -------------------------------------------------------------
  const items = collect(wf['workflow-item']);
  md += `<details>\n<summary><h2>Workflow Elements</h2></summary>\n\n`;
  for (const el of items) {
    const elName = el['display-name']?._ ?? el.name;
    md += `#### Element: ${elName}\n`;
    md += `- **Type:** ${el.type}\n`;
    md += `- **Description:** ${el.description?._ ?? el.description ?? '_No description provided_'}\n`;

    // bindings
    const inB = collect(el['in-binding']?.bind);
    if (inB.length) {
      md += `**Input Bindings:**\n\n| Name | Type | Export |\n|------|------|--------|\n`;
      md += inB.map((b) => `| ${b.name} | ${b.type} | ${b['export-name']} |`).join('\n') + '\n\n';
    }
    const outB = collect(el['out-binding']?.bind);
    if (outB.length) {
      md += `**Output Bindings:**\n\n| Name | Type | Export |\n|------|------|--------|\n`;
      md += outB.map((b) => `| ${b.name} | ${b.type} | ${b['export-name']} |`).join('\n') + '\n\n';
    }

    if (el.script?._) {
      md += `**Script:**\n\n\`\`\`javascript\n${el.script._.trim()}\n\`\`\`\n`;
    }

    md += `---\n\n`;
  }
  md += `</details>\n\n`;

  // write file ---------------------------------------------------------------
  const outFile = path.join(OUT_DIR, path.basename(file).replace(/\.xml$/, '.md'));
  await fs.writeFile(outFile, md, 'utf8');
  console.log(`✔  ${outFile}`);
}

console.log('\n✅  Documentation generated');
