/**
 * SoraLabs Motion Audit - Diagnostic Incident & Remediation Engine
 * Generates structured technical directives for automated remediation and AI coding assistants.
 */

/**
 * Generates an engineering remediation brief for runtime performance incidents.
 */
export const generateIncidentRemediationPrompt = (
  url: string,
  summary: string,
  resolution: string,
  selectors: string[] = []
): string => {
  const uniqueSelectors = [...new Set(selectors.filter(Boolean))];
  const lines: string[] = [
    "### [SoraLabs Performance Incident] Runtime Rendering Degradation",
    `**Target URL:** ${url}`,
    "",
    "#### Diagnostic Evidence",
    summary,
  ];

  if (uniqueSelectors.length > 0) {
    lines.push("", "#### Affected DOM Targets");
    for (const s of uniqueSelectors) {
      lines.push(`- \`${s}\``);
    }
  }

  lines.push(
    "",
    "#### Proposed Remediation",
    resolution,
    "",
    "#### Remediation Directives",
    "1. Treat the diagnostic summary as observed evidence and the proposed remediation as a hypothesis to verify, not as proof of root cause.",
    "2. Identify the recurring main-thread Style, Layout, Paint, or Script work attributable to the affected animation before choosing an optimization.",
    "3. Where visual behavior permits, prefer compositor-friendly properties such as `transform` and `opacity` over changes that invalidate layout or paint.",
    "4. Do not assume arbitrary JavaScript can move to the compositor thread. Use a Web Worker only for suitable non-DOM computation when profiling justifies it.",
    "",
    "#### Constraints",
    "- Make the smallest production-safe patch that addresses this incident; avoid unrelated refactors.",
    "- Preserve visual output, timing, focus, hit testing, responsive behavior, and other interaction semantics.",
    "- Do not add `will-change` by default. Use it only when profiling shows a meaningful benefit, and remove it when the animation ends where appropriate.",
    "- If equivalence cannot be established, retain the existing behavior and explain the trade-off instead of applying a speculative optimization.",
    "",
    "#### Verification Criteria",
    "1. Reproduce the affected interaction and record a Chrome DevTools Performance trace before and after the patch.",
    "2. Confirm that the identified recurring work is eliminated or materially reduced during the affected animation.",
    "3. Confirm that the intended visual and interaction behavior remains intact and that no new performance regression is introduced.",
    "4. Explain any remaining Style, Layout, Paint, or Script activity that cannot reasonably be eliminated."
  );

  return lines.join("\n");
};

/**
 * Generates targeted remediation for forced synchronous reflow / layout-triggering animations.
 */
export const generateLayoutRefactorPrompt = (
  url: string,
  summary: string,
  selectors: string[] = []
): string => {
  const uniqueSelectors = [...new Set(selectors.filter(Boolean))];
  return [
    "### [SoraLabs Performance Incident] Forced Geometric Reflow",
    `**Target URL:** ${url}`,
    "",
    "#### Diagnostic Evidence",
    summary,
    "",
    "#### Affected DOM Targets",
    ...(uniqueSelectors.length > 0
      ? uniqueSelectors.map((s) => `- \`${s}\``)
      : ["- (Document root / Global render tree)"]),
    "",
    "#### Pipeline Diagnosis",
    "Animating geometric properties (`width`, `height`, `top`, `left`, `margin`) can invalidate style and layout work as the browser updates the affected geometry. Confirm the actual invalidation and its scope in a performance trace before refactoring.",
    "",
    "```diff",
    "- /* May invalidate layout during repeated animation updates */",
    // oxlint-disable-next-line no-template-curly-in-string
    "- element.style.width = `${targetWidth}px`;",
    // oxlint-disable-next-line no-template-curly-in-string
    "- element.style.left = `${targetX}px`;",
    "+ /* Illustrative only: use only after semantic equivalence is established */",
    // oxlint-disable-next-line no-template-curly-in-string
    "+ element.style.transform = `translate(${translateX}px, 0) scaleX(${scaleX})`;",
    "```",
    "",
    "#### Remediation Directives",
    "1. Before replacing `width`, `height`, `top`, or `left`, determine whether the property affects document layout, inspect dependent elements and positioning constraints, and verify the intended visual dimensions and position.",
    "2. Prefer `transform` for movement or scaling only when it preserves layout, clipping, stacking, transform origin, hit testing, content sizing, and responsive behavior. Calculate scale from a measured base dimension; do not treat a target width as a scale factor.",
    "3. Batch DOM measurements before style mutations in JavaScript animation code. Avoid read-after-write layout thrashing.",
    "4. Use `will-change` only when profiling indicates a meaningful benefit; scope it to the active animation and remove it when no longer needed where appropriate.",
    "",
    "#### Constraints",
    "- Preserve the original visual and interaction semantics. A transform changes visual presentation, not document layout, and is not automatically equivalent to changing geometry.",
    "- Keep the patch limited to the affected animation and its direct dependencies.",
    "- If a transform-based refactor is not semantically equivalent, retain the geometric property and explain why.",
    "",
    "#### Verification Criteria",
    "1. Record the affected animation in Chrome DevTools Performance before and after the patch.",
    "2. Confirm that the identified recurring Layout or Paint work is eliminated or materially reduced, rather than requiring all Layout or Paint activity to disappear.",
    "3. Verify dimensions, position, clipping, stacking, hit testing, responsive behavior, and interaction timing at relevant viewports.",
    "4. Explain any remaining Layout or Paint activity that is unrelated or cannot reasonably be eliminated.",
  ].join("\n");
};
