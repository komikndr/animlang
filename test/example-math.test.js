import assert from 'node:assert/strict';
import test from 'node:test';
import { Q, K, V, softmax } from '../examples/shared/math.js';

test('the demo displays the correct numerical Q, K, and V products', () => {
  assert.deepEqual(Q, [[-2,-1,3],[2,3,-3],[1,1,2]]);
  assert.deepEqual(K, [[3,-2,2],[0,2,1],[2,1,2]]);
  assert.deepEqual(V, [[0,3,1],[1,0,1],[2,2,0]]);
});

test('toy vocabulary probabilities are finite, normalized, and ordered by logits', () => {
  const probabilities=softmax([1,2,-2,0,3,0]);
  assert.ok(probabilities.every(value=>Number.isFinite(value)&&value>0&&value<1));
  assert.ok(Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.equal(probabilities.indexOf(Math.max(...probabilities)),4);
  assert.ok(Math.abs(probabilities[4]-.6213)<.0001);
});
