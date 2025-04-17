// scripts/parse-vro.js
import { promises as fs } from 'node:fs';
import { parseStringPromise } from 'xml2js';

/** Ładuje jeden plik XML i zwraca obiekt JS. */
export async function loadXml(file) {
  const xml = await fs.readFile(file, 'utf8');
  return parseStringPromise(xml, { explicitArray: false, mergeAttrs: true, explicitCharkey: true });
}

/** Przyjmuje obiekt workflow i wyciąga tablicę skryptów JS (string). */
export function extractScripts(workflowObj) {
  const items = workflowObj.workflow['workflow-item'] ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr
    .filter((i) => i.type === 'task' && i.script?._) // ._ = tekst w CDATA
    .map((i) => ({
      name: i['display-name']?._ ?? i.name ?? 'unknown',
      code: i.script._.replace(/^<!\[CDATA\[|\]\]>$/g, ''), // zdejmij CDATA
    }));
}

/** Zwraca przydatne metadane z workflow do dokumentacji. */
export function meta(workflowObj) {
  const wf = workflowObj.workflow;
  return {
    id: wf.id,
    name: wf['display-name']?._ ?? wf['object-name'],
    version: wf.version,
    inParams: wf.input?.param ?? [],
    outParams: wf.output?.param ?? [],
    attrib: wf.attrib ?? [],
  };
}
