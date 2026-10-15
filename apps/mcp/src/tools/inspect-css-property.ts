import {
  classifyPropertyCost,
  classifyPropertyStage,
  PIPELINE_COSTS,
} from "@soralasbs/motion-audit";
import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

export const schema = {
  properties: z
    .array(z.string())
    .describe(
      "Array of CSS properties to evaluate (e.g. ['transform', 'opacity', 'width', 'box-shadow', 'top', '--custom-var'])"
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
    title: "Inspect CSS Animation Property Costs",
  },
  description:
    "Evaluates CSS properties against the browser rendering pipeline model (Compositor vs Paint vs Layout). Tells AI whether an animation triggers expensive rasterization or reflow and provides compositor-friendly alternatives.",
  name: "inspect_css_property",
};

const PROPERTY_RECOMMENDATIONS = {
  bottom: "Use `transform: translateY(...)` instead of `bottom`.",
  "box-shadow":
    "Animate `opacity` on an absolutely positioned pseudo-element (`::after`) with pre-rendered `box-shadow` instead of animating `box-shadow` directly.",
  filter:
    "Hardware accelerated on compositor in modern browsers, but heavy blur radii on large surfaces can increase GPU shader load. Keep radii small.",
  height: "Use `transform: scaleY(...)` instead of `height`.",
  left: "Use `transform: translateX(...)` instead of `left`.",
  margin: "Use `transform: translate(...)` instead of `margin`.",
  padding:
    "Animate inner child elements with `transform` or use `clip-path` instead of `padding`.",
  right: "Use `transform: translateX(...)` instead of `right`.",
  top: "Use `transform: translateY(...)` instead of `top`.",
  width: "Use `transform: scaleX(...)` instead of `width`.",
} as const;

const STAGE_BADGES = {
  COMPOSITOR: "COMPOSITOR (Zero main-thread)",
  CSS_VARIABLE: "CSS_VARIABLE (Subtree style recalc)",
  LAYOUT: "LAYOUT (Geometry reflow)",
  PAINT: "PAINT (Raster invalidation)",
} as const;

const getRecommendation = (prop: string, cost: number): string => {
  if (prop in PROPERTY_RECOMMENDATIONS) {
    // SAFETY: Verified membership in PROPERTY_RECOMMENDATIONS
    return PROPERTY_RECOMMENDATIONS[
      prop as keyof typeof PROPERTY_RECOMMENDATIONS
    ];
  }

  if (cost === PIPELINE_COSTS.COMPOSITOR) {
    return "Excellent candidate for 60fps/120fps GPU compositor animation.";
  }
  if (cost === PIPELINE_COSTS.PAINT) {
    return "Causes main-thread paint raster invalidation. Look for an opacity-based composite workaround.";
  }
  if (cost === PIPELINE_COSTS.LAYOUT) {
    return "Forces synchronous layout geometry reflow. Convert to `transform` (scale/translate).";
  }
  return "CSS custom property forces subtree style recalculations.";
};

export default function inspectCssProperty({
  properties,
}: InferSchema<typeof schema>) {
  if (properties.length === 0) {
    return "Please provide at least one CSS property to inspect.";
  }

  const results = properties.map((prop) => {
    const stage = classifyPropertyStage(prop);
    const cost = classifyPropertyCost(prop);
    const recommendation = getRecommendation(prop, cost);

    return {
      cost,
      property: prop,
      recommendation,
      stage,
    };
  });

  const lines = [
    "# CSS Animation Pipeline Evaluation",
    "",
    "| Property | Pipeline Stage | Invalidation Cost | Assessment |",
    "| :--- | :--- | :--- | :--- |",
  ];

  for (const r of results) {
    // SAFETY: Pipeline stages match STAGE_BADGES keys
    const badge = STAGE_BADGES[r.stage as keyof typeof STAGE_BADGES] ?? r.stage;
    lines.push(
      `| \`${r.property}\` | **${r.stage}** | \`${r.cost}\` | ${badge} |`
    );
  }

  lines.push("", "### AI Optimization Directives:");
  let index = 1;
  for (const r of results) {
    lines.push(`${index}. **\`${r.property}\`**: ${r.recommendation}`);
    index += 1;
  }

  return {
    content: [
      {
        text: lines.join("\n"),
        type: "text",
      },
    ],
    structuredContent: {
      pipelineCosts: PIPELINE_COSTS,
      properties: results,
    },
  };
}
