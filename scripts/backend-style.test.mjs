import assert from 'node:assert/strict';
import test from 'node:test';
import { spaceReturns } from './backend-style.mjs';

test('spaces returns after statements and opening braces, including bare returns', () => {
  const source = '{\n    return value;\n}\nDoWork();\nreturn;\n';
  const expected = '{\n\n    return value;\n}\nDoWork();\n\nreturn;\n';
  assert.equal(spaceReturns(source), expected);
  assert.equal(spaceReturns(expected), expected);
});

test('does not change return text inside comments or ordinary string literals', () => {
  const source = '// return value;\nvar message = "return value";\n';
  assert.equal(spaceReturns(source), source);
});
