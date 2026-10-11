import { run, bench, group } from "mitata";

import { classifyPropertyCost } from "../../src/math/scaling.js";
import type { ThrashViolation } from "../../src/math/thrashing-graph.js";
import { analyzeLayoutThrashing } from "../../src/math/thrashing-graph.js";
import { evaluateGpuResourcePressure } from "../../src/math/vram.js";

const makeViolations = (n: number): ThrashViolation[] =>
  Array.from({ length: n }, (_, i) => ({
    api: i % 2 === 0 ? "offsetHeight" : "getComputedStyle",
    frame: Math.floor(i / 10),
    readSelector: `.item-${i % 20}`,
    type: (i % 2 === 0 ? "layout" : "style") as const,
    writeSelector: `.item-${i % 20}`,
  }));

const n10 = makeViolations(10);
const n100 = makeViolations(100);
const n1000 = makeViolations(1000);
const n5000 = makeViolations(5000);
const n10000 = makeViolations(10_000);

group("Layout Thrashing Graph Complexity — O(N) Scaling", () => {
  bench("N = 10", () => analyzeLayoutThrashing(n10));
  bench("N = 100", () => analyzeLayoutThrashing(n100));
  bench("N = 1,000", () => analyzeLayoutThrashing(n1000));
  bench("N = 5,000", () => analyzeLayoutThrashing(n5000));
  bench("N = 10,000", () => analyzeLayoutThrashing(n10000));
});

group("Property Pipeline Cost (Single Call Granularity)", () => {
  bench("compositor: transform", () => classifyPropertyCost("transform"));
  bench("paint: background-color", () =>
    classifyPropertyCost("background-color"));
  bench("layout: width", () => classifyPropertyCost("width"));
  bench("custom-var: --accent", () => classifyPropertyCost("--accent"));
});

group("GPU VRAM Band Interpolation", () => {
  bench("desktop 128MB tier A", () =>
    evaluateGpuResourcePressure({
      compositedVramBytes: 128 * 1024 * 1024,
      deviceContext: "desktop",
      layerCount: 40,
      tiledBackingBytes: 64 * 1024 * 1024,
    }));
});

await run();
