const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSystemPrompt } = require('../background');

test('buildSystemPrompt uses blocks guidance when editorMode is blocks', () => {
  const prompt = buildSystemPrompt('basic code', 2, 'blocks');

  assert.match(prompt, /BLOCKS EDITOR/);
  assert.match(prompt, /NEVER show TypeScript\/JavaScript code snippets/);
  assert.match(prompt, /Sprites/);
  assert.match(prompt, /basic code/);
});

test('buildSystemPrompt uses TypeScript guidance when editorMode is typescript', () => {
  const prompt = buildSystemPrompt('let x = 1', 3, 'typescript');

  assert.match(prompt, /TypeScript\/JavaScript text editor/);
  assert.match(prompt, /TypeScript code examples/);
  assert.match(prompt, /sprites\.create\(\)/);
  assert.match(prompt, /let x = 1/);
});

test('buildSystemPrompt defaults to level 3 description for unknown complexity', () => {
  const prompt = buildSystemPrompt('code', 99, 'blocks');

  assert.match(prompt, /basic programming knowledge/);
});

test('buildSystemPrompt defaults to blocks guidance when editorMode is omitted', () => {
  const prompt = buildSystemPrompt('code', 1);

  assert.match(prompt, /BLOCKS EDITOR/);
  assert.match(prompt, /NEVER show TypeScript\/JavaScript code snippets/);
});
