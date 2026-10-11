/**
 * In-Page Telemetry Script for Motion Audit
 * Injected into the browser to capture runtime animations, scroll listeners, and layout thrashing.
 */

import type { AnimationSource } from "../types.js";

export const INPAGE_INIT_SCRIPT = `
(() => {
  if (window.__MOTION_AUDIT__) return;

  const thrashingLog = [];
  const scrollListeners = [];
  let hasLayoutOnScroll = false;
  const jsAnimatedElements = new Map();
  const waapiAnimationFrames = new Map();
  const longAnimationFrames = [];
  const scrollPhaseFrames = new Set();
  const scrollLinkedAnimations = new WeakSet();
  const scrollTriggeredCandidates = new WeakSet();
  let scrollEventCount = 0;
  let lastScrollEventFrame = 0;
  let lastWriteTimestamp = 0;
  let lastWriteProperty = '';
  let lastWriteSelector = '';
  let currentFrameIndex = 0;
  let isInsideRaf = false;
  let isScrolling = false;

  if (typeof PerformanceObserver === 'function') {
    try {
      const loafObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longAnimationFrames.push({
            duration: entry.duration,
            blockingDuration: entry.blockingDuration
          });
        }
      });
      loafObserver.observe({ type: 'long-animation-frame', buffered: true });
    } catch {}
  }

  window.addEventListener('scroll', () => {
    scrollEventCount++;
    lastScrollEventFrame = currentFrameIndex;
    isScrolling = true;
    setTimeout(() => { isScrolling = false; }, 60);
  }, { passive: true, capture: true });

  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    return origRAF.call(window, function(timestamp) {
      isInsideRaf = true;
      currentFrameIndex++;
      if (isScrolling) scrollPhaseFrames.add(currentFrameIndex);
      if (typeof document.getAnimations === 'function') {
        for (const animation of document.getAnimations()) {
          const timelineName = animation.timeline?.constructor?.name;
          if (timelineName === 'ScrollTimeline' || timelineName === 'ViewTimeline') {
            scrollLinkedAnimations.add(animation);
          } else if (lastScrollEventFrame > 0 && currentFrameIndex - lastScrollEventFrame <= 2) {
            scrollTriggeredCandidates.add(animation);
          }
          const frames = waapiAnimationFrames.get(animation) || new Set();
          frames.add(currentFrameIndex);
          waapiAnimationFrames.set(animation, frames);
        }
      }
      try {
        cb(timestamp);
      } finally {
        isInsideRaf = false;
      }
    });
  };

  function getSelector(el) {
    if (!el || el === window) return 'window';
    if (el === document || el.nodeType === 9) return 'document';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    if (!(el instanceof Element)) return el.nodeName ? el.nodeName.toLowerCase() : 'window';
    if (el.id) return '#' + el.id;

    const parts = [];
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement && parts.length < 3) {
      let seg = curr.tagName.toLowerCase();
      if (curr.id) {
        parts.unshift('#' + curr.id);
        break;
      }
      if (curr.classList && curr.classList.length > 0) {
        seg += '.' + curr.classList[0];
      } else if (curr.parentElement) {
        const idx = Array.prototype.indexOf.call(curr.parentElement.children, curr) + 1;
        seg += ':nth-child(' + idx + ')';
      }
      parts.unshift(seg);
      curr = curr.parentElement;
    }
    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  // 1. Intercept scroll event listeners
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (type === 'scroll') {
      let isPassive = false;
      if (typeof options === 'object' && options !== null) {
        isPassive = Boolean(options.passive);
      }
      const listenerSource = typeof listener === 'function' ? Function.prototype.toString.call(listener) : '';
      scrollListeners.push({
        selector: getSelector(this),
        passive: isPassive,
        hasRafOrDebounce: /\brequestAnimationFrame\b|\b(?:debounce|throttle)\b/.test(listenerSource)
      });
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  // 2. Track DOM style writes via standard Web IDL descriptors
  let isDomDirty = false;
  let isInternalRead = false;

  const markWrite = (prop, el) => {
    lastWriteTimestamp = performance.now();
    lastWriteProperty = prop || 'style';
    lastWriteSelector = el ? getSelector(el) : '';
    // Chromium cc: compositor-only mutations do not dirty the layout tree
    const p = String(prop || '').toLowerCase();
    if (!/^(transform|translate|rotate|scale|opacity|filter|will-change)/.test(p)) {
      isDomDirty = true;
    }
  };

  const origSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function(property, value, priority) {
    if (this.getPropertyValue(property) !== String(value)) {
      markWrite(property, null);
    }
    return origSetProperty.call(this, property, value, priority);
  };

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name === 'style') {
      const oldStyle = this.getAttribute('style');
      if (oldStyle !== value) markWrite('style', this);
    }
    return originalSetAttribute.call(this, name, value);
  };

  // Auto-hook CSS property setters on CSSStyleDeclaration prototype
  try {
    const proto = CSSStyleDeclaration.prototype;
    const descriptors = Object.getOwnPropertyDescriptors(proto);
    for (const prop in descriptors) {
      const desc = descriptors[prop];
      if (desc && desc.set && typeof prop === 'string' && !prop.startsWith('_') && prop !== 'parentRule') {
        const origSet = desc.set;
        Object.defineProperty(proto, prop, {
          set(val) {
            try {
              if (this[prop] !== val) {
                markWrite(prop, null);
              }
            } catch {
              markWrite(prop, null);
            }
            return origSet.call(this, val);
          },
          get: desc.get,
          configurable: true,
          enumerable: desc.enumerable
        });
      }
    }
  } catch {}

  // 3. Track Forced Reflow / Layout Thrashing reads
  function recordRead(prop, el, readType) {
    if (!isDomDirty || isInternalRead) return;
    const now = performance.now();
    if (now - lastWriteTimestamp < 16.7 && lastWriteTimestamp > 0) {
      const isFramePhase = isInsideRaf;
      const effectiveFrame = isInsideRaf ? currentFrameIndex : 0;
      thrashingLog.push({
        type: readType || (prop === 'getComputedStyle' ? 'style' : 'layout'),
        property: prop,
        selector: getSelector(el),
        frameIndex: effectiveFrame,
        phase: isFramePhase ? 'frame' : 'init',
        causeProperty: lastWriteProperty,
        causeSelector: lastWriteSelector,
        duringScroll: isScrolling
      });
      if (isScrolling && readType === 'layout') hasLayoutOnScroll = true;
      // In Chromium, querying layout immediately forces style/layout tree update, making DOM clean again
      isDomDirty = false;
    }
  }

  const readProps = [
    'offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth',
    'scrollHeight', 'scrollWidth', 'offsetTop', 'offsetLeft',
    'scrollTop', 'scrollLeft'
  ];

  for (const prop of readProps) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    if (descriptor && descriptor.get) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        get() {
          recordRead(prop, this, 'layout');
          return descriptor.get.call(this);
        }
      });
    }
  }

  const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() {
    recordRead('getBoundingClientRect', this, 'layout');
    return origGetBoundingClientRect.call(this);
  };

  const origGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function() {
    recordRead('getClientRects', this, 'layout');
    return origGetClientRects.call(this);
  };

  if (typeof window.getComputedStyle === 'function') {
    const origGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function(elt, pseudoElt) {
      recordRead('getComputedStyle', elt, 'style');
      return origGetComputedStyle.call(this, elt, pseudoElt);
    };
  }

  // 4. Clean-room JS Animation detection via native W3C MutationObserver
  if (typeof MutationObserver === 'function') {
    const SVG_ATTRS = ['d', 'points', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'stroke-dashoffset', 'stroke-dasharray', 'viewBox', 'transform'];
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'attributes' && m.attributeName) {
          const attr = m.attributeName;
          const el = m.target;
          if (attr === 'style' && el instanceof HTMLElement) {
            const entry = jsAnimatedElements.get(el) || { count: 0, props: new Set(), frames: new Set() };
            entry.count++;
            if (isInsideRaf && currentFrameIndex > 0) entry.frames.add(currentFrameIndex);
            const currentStyle = el.getAttribute('style') || '';
            const parts = currentStyle.split(';');
            for (let j = 0; j < parts.length; j++) {
              const p = parts[j].split(':')[0]?.trim();
              if (p) entry.props.add(p);
            }
            jsAnimatedElements.set(el, entry);
          } else if (typeof SVGElement !== 'undefined' && el instanceof SVGElement && SVG_ATTRS.includes(attr)) {
            const entry = jsAnimatedElements.get(el) || { count: 0, props: new Set(), frames: new Set() };
            entry.count++;
            if (isInsideRaf && currentFrameIndex > 0) entry.frames.add(currentFrameIndex);
            entry.props.add(attr);
            jsAnimatedElements.set(el, entry);
          }
        }
      }
    });

    const startObserve = () => {
      if (document.documentElement) {
        observer.observe(document.documentElement, {
          attributes: true,
          subtree: true,
          attributeFilter: ['style', ...SVG_ATTRS]
        });
      }
    };

    if (document.documentElement) startObserve();
    else document.addEventListener('DOMContentLoaded', startObserve);
  }

  window.__MOTION_AUDIT__ = {
    getScrollData() {
      // Normal scroll on window/document without layout mutation doesn't block compositor thread
      const activeListeners = scrollListeners.filter((l) => {
        const isRoot = ['window', 'document', 'html', 'body'].includes(l.selector);
        return !(isRoot && !hasLayoutOnScroll && l.passive);
      });
      return {
        listeners: activeListeners,
        hasLayoutOnScroll
      };
    },
    getThrashingData() {
      return thrashingLog;
    },
    getLongAnimationFrameData() {
      return {
        supported: longAnimationFrames.length > 0 ||
          typeof PerformanceObserver === 'function' &&
          PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame') === true,
        entries: longAnimationFrames
      };
    },
    getWaapiAnimationFrames() {
      const results = [];
      for (const [animation, frames] of waapiAnimationFrames.entries()) {
        const target = animation.effect && animation.effect.target;
        if (!target) continue;
        const properties = [];
        if (animation.effect.getKeyframes) {
          for (const keyframe of animation.effect.getKeyframes()) {
            for (const property of Object.keys(keyframe)) {
              if (!['offset', 'easing', 'composite', 'computedOffset'].includes(property)) {
                properties.push(property);
              }
            }
          }
        }
        results.push({
          selector: getSelector(target),
          properties: Array.from(new Set(properties)),
          frames: Array.from(frames)
        });
      }
      return results;
    },
    getScrollPhaseData() {
      let animationSampleCount = 0;
      let scrollLinkedAnimationCount = 0;
      let scrollTriggeredCandidateCount = 0;
      for (const frames of waapiAnimationFrames.values()) {
        for (const frame of frames) {
          if (scrollPhaseFrames.has(frame)) animationSampleCount++;
        }
      }
      for (const animation of document.getAnimations()) {
        if (scrollLinkedAnimations.has(animation)) scrollLinkedAnimationCount++;
        if (scrollTriggeredCandidates.has(animation)) scrollTriggeredCandidateCount++;
      }
      return {
        scrollEventCount,
        scrollFrameCount: scrollPhaseFrames.size,
        animationSampleCount,
        scrollLinkedAnimationCount,
        scrollTriggeredCandidateCount
      };
    },
    getJsAnimations() {
      isInternalRead = true;
      try {
        const results = [];
        let idx = 0;
        for (const [el, data] of jsAnimatedElements.entries()) {
          // Require at least 5 frames/updates (prevents 1-2 resize sets from being falsely classified as animations)
          const frameCount = data.frames ? data.frames.size : 0;
          const isSustained = frameCount >= 5 || data.count >= 5;
          if (isSustained) {
            let rect = { width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 };
            try {
              if (typeof el.getBoundingClientRect === 'function') {
                rect = el.getBoundingClientRect();
              }
            } catch {}
            const vpW = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 1000);
            const vpH = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 1000);
            const buffer = 400;
            const isOffscreen = rect.bottom <= -buffer || rect.top >= vpH + buffer || rect.right <= -buffer || rect.left >= vpW + buffer;
            results.push({
              id: 'js-anim-' + (idx++),
              selector: getSelector(el),
              properties: Array.from(data.props),
              source: 'js-loop',
              durationMs: 600,
              iterations: Infinity,
              paintArea: Math.max(100, (rect.width || 100) * (rect.height || 100)),
              isOffscreen
            });
          }
        }
        return results;
      } finally {
        isInternalRead = false;
      }
    }
  };
})();
`;

export type InpageThrashingType = "read" | "write" | "style" | "layout";

export interface InpageTelemetryResult {
  animations: {
    id: string;
    selector: string;
    properties: string[];
    source: AnimationSource;
    durationMs: number;
    paintArea: number;
    isOffscreen?: boolean;
  }[];
  scroll: {
    listenerCount: number;
    usesPassive: boolean;
    usesRafOrDebounce: boolean;
    selectors: string[];
    hasLayoutOnScroll: boolean;
  };
  thrashing: {
    type: InpageThrashingType;
    property: string;
    selector: string;
    frameIndex: number;
    duringScroll?: boolean;
  }[];
  libraries: string[];
  longAnimationFrames: {
    supported: boolean;
    entries: { duration: number; blockingDuration: number }[];
  };
  waapiAnimationFrames: {
    selector: string;
    properties: string[];
    frames: number[];
  }[];
  scrollPhase: {
    scrollEventCount: number;
    scrollFrameCount: number;
    animationSampleCount: number;
  };
}
