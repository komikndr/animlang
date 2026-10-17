export const clamp = value => Math.max(0, Math.min(1, value));
export const mix = (a, b, amount) => a + (b - a) * amount;
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
export const transpose = matrix => matrix[0].map((_, column) => matrix.map(row => row[column]));
export const multiply = (a, b) => a.map(row => b[0].map((_, column) =>
  row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
export const softmax = row => {
  const values = row.map(value => Math.exp(value - Math.max(...row)));
  const total = values.reduce((a, b) => a + b, 0);
  return values.map(value => value / total);
};

// Reduced, invented tensors. These are demonstration values, not model weights.
export const X = [[1, 0, -1, 2], [0, 2, 1, -1], [2, 1, 0, 1]];
export const WQ = [[1, 0, 1], [0, 1, -1], [1, 1, 0], [-1, 0, 1]];
export const WK = [[0, 1, 0], [1, 0, 1], [-1, 1, 0], [1, -1, 1]];
export const WV = [[1, 0, -1], [0, 1, 1], [1, -1, 0], [0, 1, 1]];
export const Q = multiply(X, WQ);
export const K = multiply(X, WK);
export const V = multiply(X, WV);
