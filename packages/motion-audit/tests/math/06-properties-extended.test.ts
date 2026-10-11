import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  classifyPropertyCost,
  getMaxPropertyCost,
  PIPELINE_COSTS,
} from "../../src/math/scaling.ts";

describe("Scaling Math: Extended Property Vector & CSS Variables", () => {
  test("correctly classifies compositor properties (Zero main-thread penalty)", () => {
    assert.equal(classifyPropertyCost("transform"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("opacity"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("filter"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("clip-path"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("translate"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("scale"), PIPELINE_COSTS.COMPOSITOR);
    assert.equal(classifyPropertyCost("rotate"), PIPELINE_COSTS.COMPOSITOR);
  });

  test("correctly classifies paint properties (Main-thread raster penalty)", () => {
    assert.equal(
      classifyPropertyCost("background-color"),
      PIPELINE_COSTS.PAINT
    );
    assert.equal(classifyPropertyCost("color"), PIPELINE_COSTS.PAINT);
    assert.equal(classifyPropertyCost("border-radius"), PIPELINE_COSTS.PAINT);
    assert.equal(classifyPropertyCost("box-shadow"), PIPELINE_COSTS.PAINT);
    assert.equal(classifyPropertyCost("outline"), PIPELINE_COSTS.PAINT);
    assert.equal(
      classifyPropertyCost("stroke-dashoffset"),
      PIPELINE_COSTS.PAINT
    );
    assert.equal(
      classifyPropertyCost("stroke-dasharray"),
      PIPELINE_COSTS.PAINT
    );
    assert.equal(classifyPropertyCost("stroke-width"), PIPELINE_COSTS.PAINT);
  });

  test("correctly classifies custom CSS variables (--*) as style recalc penalty", () => {
    assert.equal(
      classifyPropertyCost("--primary-color"),
      PIPELINE_COSTS.CSS_VARIABLE
    );
    assert.equal(
      classifyPropertyCost("--custom-offset"),
      PIPELINE_COSTS.CSS_VARIABLE
    );
    assert.equal(
      classifyPropertyCost("--theme-bg"),
      PIPELINE_COSTS.CSS_VARIABLE
    );
  });

  test("correctly classifies layout properties (Forced reflow penalty)", () => {
    assert.equal(classifyPropertyCost("width"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("height"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("top"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("left"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("margin"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("padding"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("flex"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("grid"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("d"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("points"), PIPELINE_COSTS.LAYOUT);
    assert.equal(classifyPropertyCost("viewBox"), PIPELINE_COSTS.LAYOUT);
  });

  test("getMaxPropertyCost resolves highest cost in property array", () => {
    assert.equal(
      getMaxPropertyCost(["transform", "opacity"]),
      PIPELINE_COSTS.COMPOSITOR
    );
    assert.equal(
      getMaxPropertyCost(["transform", "background-color"]),
      PIPELINE_COSTS.PAINT
    );
    assert.equal(
      getMaxPropertyCost(["transform", "width", "background-color"]),
      PIPELINE_COSTS.LAYOUT
    );
    assert.equal(
      getMaxPropertyCost(["stroke-dashoffset", "d"]),
      PIPELINE_COSTS.LAYOUT
    );
    assert.equal(getMaxPropertyCost([]), PIPELINE_COSTS.COMPOSITOR);
  });
});
