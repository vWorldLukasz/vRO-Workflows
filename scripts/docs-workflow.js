// docs-workflow.js — generate Markdown docs from vRO XML + local forms
// -----------------------------------------------------------------------------
//  ▸ VRO_GLOB   – glob z plikami *.workflow.xml   (domyślnie **/*workflow.xml)
//  ▸ OUT_DIR    – katalog wyjściowy              (domyślnie docs/workflows)
//
//  Dane formularza pobieramy z forms/_.json leżącego obok workflow.xml.
//  Nie wykonujemy ŻADNYCH zapytań HTTP.
//
//  Uruchomienie w GitHub Actions:
//    - name: Build Markdown docs
//      env:
//        VRO_GLOB: '**/*workflow.xml'
//      run: node scripts/docs-workflow.js
// -----------------------------------------------------------------------------

import fg from 'fast-glob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadXml } from './parse-vro.js';

// -----------------------------------------------------------------------------
// ustawienia
const GLOB    = process.env.VRO_GLOB || '**/*workflow.xml';
const OUT_DIR = process.env.OUT_DIR  || 'docs/workflows';
await fs.mkdir(OUT_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// utilsy
const collect = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const fence   = (code, lang = 'javascript') => `\`\`\`${lang}\n${code}\n\`\`\``;
// wyciąga tekst z node {_: 'txt'} lub zwraca pusty string
const txt     = (n) => (typeof n === 'string' ? n : n?._ ?? '');

// generator tabeli Markdown
function table(arr, cols) {
  if (!arr.length) return '';
  const header    = `| ${cols.map((c) => c.header).join(' | ')} |\n`;
  const separator = `| ${cols.map(() => '---').join(' | ')} |\n`;
  const rows      = arr
    .map((r) => `| ${cols.map((c) => r[c.key] ?? '').join(' | ')} |`)
    .join('\n');
  return header + separator + rows + '\n';
}

// -----------------------------------------------------------------------------
// główny przebieg
const xmlFiles = await fg(GLOB, { dot: true });
console.log(`📝  Generating docs for ${xmlFiles.length} workflow(s)\n`);

for (const xmlFile of xmlFiles) {
  /* ----------------- 1. parse XML ---------------------------------------- */
  const wfObj = await loadXml(xmlFile);
  const root  = wfObj[Object.keys(wfObj)[0]];        // obsługa namespace

  const wfName    = txt(root['display-name']) || root['object-name'] || path.basename(xmlFile);
  const wfId      = root.id      ?? 'n/a';
  const wfVersion = root.version ?? 'n/a';
  const wfDesc    = txt(root.description) || '_No description provided_';

  const attribs       = collect(root.attrib);
  const inputs        = collect(root.input?.param);
  const outputs       = collect(root.output?.param);
  const items         = collect(root['workflow-item']);
  const errorHandlers = collect(root['error-handler']);

  /* ----------------- 2. linkowane elementy ------------------------------ */
  const linkedWf  = [];
  const linkMods  = [];

  for (const el of items) {
    const elName = txt(el['display-name']) || el.name || 'unknown';
    if (el.type === 'link' && el['linked-workflow-id']) {
      linkedWf.push({ id: el['linked-workflow-id'], name: elName });
    }
    if (el['script-module']) linkMods.push(el['script-module']);
  }

  /* ----------------- 3. formularz (forms/_.json) ------------------------ */
  let formProps = [];
  try {
    const formRaw = await fs.readFile(path.join(path.dirname(xmlFile), 'forms', '_.json'), 'utf8');
    const schema  = JSON.parse(formRaw).schema ?? {};
    formProps     = Object.values(schema).map((p) => ({
      id: p.id,
      label: p.label,
      dataType: p.type?.dataType ?? '',
      constraints: JSON.stringify(p.constraints ?? {}),
      default: JSON.stringify(p.default ?? {}),
      valueList: JSON.stringify(p.valueList ?? {}),
      signpost: p.signpost ?? '',
    }));
  } catch {
    /* brak formularza — ignorujemy */
  }

  /* ----------------- 4. budujemy Markdown ------------------------------- */
  let md = `# ${wfName} - Workflow Documentation\n\n`;

  // ——— Workflow details
  md += `<details>\n<summary><h2>Workflow Details</h2></summary>\n\n`;
  md += `- **Workflow Name:** ${wfName}\n`;
  md += `- **Workflow ID:** \`${wfId}\`\n`;
  md += `- **Version:** ${wfVersion}\n`;
  md += `- **Description:** ${wfDesc}\n`;
  md += `</details>\n\n`;

  // ——— Variables / Inputs / Outputs / Form
  if (attribs.length)
    md += `<details>\n<summary><h2>Workflow Variables</h2></summary>\n\n`
        + table(attribs, [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
          ])
        + `\n</details>\n\n`;

  if (inputs.length)
    md += `<details>\n<summary><h2>Workflow Inputs</h2></summary>\n\n`
        + table(inputs, [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
          ])
        + `\n</details>\n\n`;

  if (outputs.length)
    md += `<details>\n<summary><h2>Workflow Outputs</h2></summary>\n\n`
        + table(outputs, [
            { key: 'name', header: 'Name' },
            { key: 'type', header: 'Type' },
          ])
        + `\n</details>\n\n`;

  if (formProps.length)
    md += `<details>\n<summary><h2>Workflow Form</h2></summary>\n\n`
        + table(formProps, [
            { key: 'id',       header: 'ID' },
            { key: 'label',    header: 'Label' },
            { key: 'dataType', header: 'Data Type' },
            { key: 'constraints', header: 'Constraints' },
            { key: 'default',  header: 'Default' },
            { key: 'valueList', header: 'Value List' },
            { key: 'signpost', header: 'Signpost' },
          ])
        + `\n</details>\n\n`;

  // ——— Elements
  md += `<details>\n<summary><h2>Workflow Elements</h2></summary>\n\n`;
  for (const el of items) {
    const elName = txt(el['display-name']) || el.name || 'unknown';
    md += `#### Element: ${elName}\n`;
    md += `- **Type:** ${el.type}\n`;
    md += `- **Description:** ${txt(el.description) || '_No description provided_'}\n`;

    const inB  = collect(el['in-binding']?.bind);
    const outB = collect(el['out-binding']?.bind);

    if (inB.length)
      md += `\n**Input Bindings:**\n\n`
          + table(inB, [
              { key: 'name', header: 'Variable Name' },
              { key: 'type', header: 'Type' },
              { key: 'export-name', header: 'Workflow Variable' },
            ]);

    if (outB.length)
      md += `\n**Output Bindings:**\n\n`
          + table(outB, [
              { key: 'name', header: 'Variable Name' },
              { key: 'type', header: 'Type' },
              { key: 'export-name', header: 'Workflow Variable' },
            ]);

    if (el.script?._) md += `\n**Script:**\n\n${fence(el.script._.trim())}\n`;

    md += '\n---\n\n';
  }
  md += `</details>\n\n`;

  // ——— Error handlers
  md += `<details>\n<summary><h2>Error Handlers</h2></summary>\n\n`;
  if (errorHandlers.length)
    errorHandlers.forEach((eh) =>
      (md += `- **Element Name:** ${eh.name} (throws: ${eh['throw-bind-name'] ?? '_None_'})\n`));
  else md += '_No error handlers defined._\n';
  md += `</details>\n\n`;

  // ——— Linked workflows
  md += `<details>\n<summary><h2>Linked Workflows</h2></summary>\n\n`;
  if (linkedWf.length)
    linkedWf.forEach((lw) =>
      (md += `- **Name:** ${lw.name}, **ID:** \`${lw.id}\`\n`));
  else md += '_No linked workflows defined._\n';
  md += `</details>\n\n`;

  // ——— Linked script modules
  if (linkMods.length) {
    md += `<details>\n<summary><h2>Linked Actions (script modules)</h2></summary>\n\n`;
    linkMods.forEach((m) => (md += `- \`${m}\`\n`));
    md += `</details>\n\n`;
  }

  /* ----------------- 5. zapis pliku -------------------------------------- */
  const outPath = path.join(OUT_DIR, `${wfName.replace(/\\s+/g, '_')}.md`);
  await fs.writeFile(outPath, md, 'utf8');
  console.log(`✔  ${outPath}`);
}

console.log('\\n✅  Documentation generated');
