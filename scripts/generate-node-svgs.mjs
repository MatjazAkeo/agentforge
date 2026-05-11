#!/usr/bin/env node
// Generates one SVG per node showing its title + ports + types.
// Output: docs/wiki/assets/nodes/<type>.svg
//
// Keep the NODES table below in sync with the actual node definitions in
// src/nodes/*.ts. The port-type colors mirror src/nodes/port-types.ts.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPE_COLORS = {
  string: '#ffaa55',
  number: '#9aa0a8',
  messages: '#b388ff',
  tools: '#ffd54a',
  'tool-calls': '#ff5577',
  json: '#4ad7e2',
  images: '#7ad48c',
  any: '#888888',
};

// [name, type] — type may be null for dynamic-port indicators.
const NODES = [
  {
    type: 'input', title: 'Input',
    inputs: [],
    outputs: [['text', 'string']],
  },
  {
    type: 'output', title: 'Output',
    inputs: [['text', 'string']],
    outputs: [],
  },
  {
    type: 'llm-call', title: 'LLM Call',
    inputs: [['messages', 'messages'], ['text', 'string'], ['images', 'images', true], ['tools', 'tools']],
    outputs: [['text', 'string'], ['messages', 'messages'], ['toolCalls', 'tool-calls'], ['usage', 'json']],
  },
  {
    type: 'tool', title: 'Tool',
    inputs: [],
    outputs: [['toolDefinition', 'tools']],
  },
  {
    type: 'tool-group', title: 'Tool Group',
    inputs: [['tools', 'tools']],
    outputs: [['toolDefinition', 'tools']],
  },
  {
    type: 'tool-runner', title: 'Tool Runner',
    inputs: [['toolCalls', 'tool-calls'], ['tools', 'tools'], ['messages', 'messages']],
    outputs: [['messages', 'messages'], ['results', 'json']],
  },
  {
    type: 'loop-controller', title: 'Loop Controller',
    inputs: [['continue', 'any'], ['input-<channel>', 'any', true], ['default-<channel>', 'any', true]],
    outputs: [['iteration', 'number'], ['output-<channel>', 'any', true]],
  },
  {
    type: 'agent', title: 'Agent',
    inputs: [['messages', 'messages'], ['text', 'string'], ['images', 'images', true], ['tools', 'tools']],
    outputs: [['text', 'string'], ['messages', 'messages'], ['iteration', 'number']],
  },
  {
    type: 'prompt-template', title: 'Prompt Template',
    inputs: [['{{ var }}', 'any', true]],
    outputs: [['text', 'string']],
  },
  {
    type: 'transform', title: 'Transform',
    inputs: [['value', 'any']],
    outputs: [['result', 'json']],
  },
  {
    type: 'chat-input', title: 'Chat Input',
    inputs: [],
    outputs: [['text', 'string'], ['messages', 'messages'], ['images', 'images']],
  },
  {
    type: 'file-input', title: 'File Input',
    inputs: [],
    outputs: [['text', 'string', true], ['images', 'images', true]],
  },
  {
    type: 'tool-pack', title: 'Tool Pack',
    inputs: [],
    outputs: [['tools', 'tools']],
  },
  {
    type: 'chat-output', title: 'Chat Output',
    inputs: [['text', 'string']],
    outputs: [],
  },
];

const W = 320;
const PADDING_TOP = 56;
const ROW_H = 28;
const PADDING_BOTTOM = 16;
const PORT_R = 6;
const TITLE_FONT = 'system-ui, sans-serif';

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderNode(node) {
  const rowCount = Math.max(node.inputs.length, node.outputs.length, 1);
  const H = PADDING_TOP + rowCount * ROW_H + PADDING_BOTTOM;

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
  // dark theme background to match the app's default
  lines.push(`<rect width="${W}" height="${H}" rx="12" ry="12" fill="#1a1d22" stroke="#2a2f37" stroke-width="1"/>`);
  // title bar
  lines.push(`<rect x="0" y="0" width="${W}" height="40" rx="12" ry="12" fill="#2a2f37"/>`);
  lines.push(`<rect x="0" y="28" width="${W}" height="12" fill="#2a2f37"/>`);
  lines.push(`<text x="${W / 2}" y="25" text-anchor="middle" font-family="${TITLE_FONT}" font-size="15" font-weight="600" fill="#e8eaed">${escape(node.title)}</text>`);
  lines.push(`<text x="${W / 2}" y="50" text-anchor="middle" font-family="${TITLE_FONT}" font-size="10" fill="#8a929c">${escape(node.type)}</text>`);

  // inputs (left) — circles inset so they sit fully inside the card
  const portInset = PORT_R + 4;
  node.inputs.forEach((p, i) => {
    const [name, type, dynamic] = p;
    const cy = PADDING_TOP + i * ROW_H + ROW_H / 2;
    const color = TYPE_COLORS[type] ?? '#888';
    const dash = dynamic ? ' stroke-dasharray="3 2"' : '';
    lines.push(`<circle cx="${portInset}" cy="${cy}" r="${PORT_R}" fill="${color}" stroke="#0d0f12" stroke-width="1.5"${dash}/>`);
    lines.push(`<text x="${portInset + PORT_R + 6}" y="${cy + 4}" font-family="${TITLE_FONT}" font-size="12" fill="#c8cdd4">${escape(name)}</text>`);
    lines.push(`<text x="${portInset + PORT_R + 6}" y="${cy + 16}" font-family="${TITLE_FONT}" font-size="9" fill="#6b7280">${escape(type)}${dynamic ? ' (dynamic)' : ''}</text>`);
  });

  // outputs (right) — circles inset so they sit fully inside the card
  node.outputs.forEach((p, i) => {
    const [name, type, dynamic] = p;
    const cy = PADDING_TOP + i * ROW_H + ROW_H / 2;
    const color = TYPE_COLORS[type] ?? '#888';
    const dash = dynamic ? ' stroke-dasharray="3 2"' : '';
    lines.push(`<circle cx="${W - portInset}" cy="${cy}" r="${PORT_R}" fill="${color}" stroke="#0d0f12" stroke-width="1.5"${dash}/>`);
    lines.push(`<text x="${W - portInset - PORT_R - 6}" y="${cy + 4}" text-anchor="end" font-family="${TITLE_FONT}" font-size="12" fill="#c8cdd4">${escape(name)}</text>`);
    lines.push(`<text x="${W - portInset - PORT_R - 6}" y="${cy + 16}" text-anchor="end" font-family="${TITLE_FONT}" font-size="9" fill="#6b7280">${escape(type)}${dynamic ? ' (dynamic)' : ''}</text>`);
  });

  lines.push(`</svg>`);
  return lines.join('\n');
}

function renderLegend() {
  const items = Object.entries(TYPE_COLORS).filter(([k]) => k !== 'any');
  const W2 = 560;
  const H2 = 120;
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W2} ${H2}" width="${W2}" height="${H2}">`);
  lines.push(`<rect width="${W2}" height="${H2}" rx="12" ry="12" fill="#1a1d22" stroke="#2a2f37"/>`);
  lines.push(`<text x="20" y="28" font-family="${TITLE_FONT}" font-size="14" font-weight="600" fill="#e8eaed">Wire types</text>`);
  items.forEach(([type, color], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 20 + col * 180;
    const y = 56 + row * 28;
    lines.push(`<circle cx="${x + 6}" cy="${y - 4}" r="${PORT_R}" fill="${color}" stroke="#0d0f12" stroke-width="1.5"/>`);
    lines.push(`<text x="${x + 22}" y="${y}" font-family="${TITLE_FONT}" font-size="12" fill="#c8cdd4">${escape(type)}</text>`);
  });
  lines.push(`</svg>`);
  return lines.join('\n');
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'docs', 'wiki', 'assets', 'nodes');
mkdirSync(outDir, { recursive: true });

for (const node of NODES) {
  const svg = renderNode(node);
  const path = resolve(outDir, `${node.type}.svg`);
  writeFileSync(path, svg);
  console.log(`wrote ${path}`);
}

writeFileSync(resolve(outDir, '_legend.svg'), renderLegend());
console.log(`wrote ${resolve(outDir, '_legend.svg')}`);
