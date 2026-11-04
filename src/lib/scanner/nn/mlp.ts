/**
 * The scanner's neural network — inference only.
 *
 * A hand-rolled multilayer perceptron: dense layers, ReLU in the hidden layer,
 * softmax on the output. The whole model is a few hundred floats shipped as
 * `weights.json` (~15KB), which is the point — a "very small neural net" that
 * runs instantly on a phone, with no tensorflow/onnx runtime in the bundle.
 *
 * Training lives outside the app in `scripts/train-scanner-nn.mjs`; this file
 * only has to be fast, total (no NaN paths) and exactly compatible with what
 * that script writes.
 */

/** One dense layer: `W[out][in]` weights plus `b[out]` biases. */
export interface MlpLayer {
  /** Row per output unit. */
  W: number[][];
  b: number[];
}

/** A trained model: hidden layers use ReLU, the final layer softmax. */
export interface MlpModel {
  /** Layer sizes, input first — e.g. `[28, 16, 6]`. */
  sizes: number[];
  layers: MlpLayer[];
}

/** Softmax over logits, overflow-safe (max-subtracted). */
export function softmax(logits: number[]): number[] {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((v) => v / sum);
}

/**
 * Run the network: `input` → probabilities for every output unit.
 *
 * Throws on a shape mismatch rather than computing nonsense — a model whose
 * first layer does not match the feature vector is a stale or corrupt
 * `weights.json`, and a confident wrong answer is worse than a loud failure.
 */
export function forward(model: MlpModel, input: number[]): number[] {
  if (model.layers.length === 0) throw new Error("MLP has no layers");
  const expectedIn = model.sizes[0];
  if (input.length !== expectedIn) {
    throw new Error(`MLP expects ${expectedIn} inputs, got ${input.length}`);
  }

  let x = input;
  for (let l = 0; l < model.layers.length; l++) {
    const { W, b } = model.layers[l];
    if (W.length !== b.length) throw new Error(`MLP layer ${l}: ${W.length} weight rows vs ${b.length} biases`);
    const isLast = l === model.layers.length - 1;
    const out = new Array<number>(b.length);
    for (let j = 0; j < b.length; j++) {
      const row = W[j];
      if (row.length !== x.length) {
        throw new Error(`MLP layer ${l} row ${j}: expects ${row.length} inputs, got ${x.length}`);
      }
      let sum = b[j];
      for (let i = 0; i < row.length; i++) sum += row[i] * x[i];
      // ReLU everywhere except the readout, which feeds softmax.
      out[j] = isLast ? sum : sum > 0 ? sum : 0;
    }
    x = out;
  }
  return softmax(x);
}

/** Index of the largest value (the predicted class). */
export function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}
