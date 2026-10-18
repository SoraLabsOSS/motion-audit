/**
 * In-Page Telemetry Script for Motion Audit
 * Injected into the browser to capture runtime animations, scroll listeners, and layout thrashing.
 */

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
  const ioTriggeredElements = new WeakSet();
  let scrollEventCount = 0;
  let lastScrollEventFrame = 0;
  let lastWriteTimestamp = 0;
  let lastWriteProperty = '';
  let lastWriteSelector = '';
  let currentFrameIndex = 0;
  let isInsideRaf = false;
  let isScrolling = false;
  let lastRafTimestamp = -1;
  let currentFrameRafCount = 0;
  let maxConcurrentRaf = 0;
  let interactionStartMs = null;

  if (typeof PerformanceObserver === 'function') {
    try {
      const loafObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longAnimationFrames.push({
            // startTime is required to separate page-load frames from scroll-phase
            // frames. Without it the two cannot be told apart after collection.
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: entry.blockingDuration
          });
        }
      });
      loafObserver.observe({ type: 'long-animation-frame', buffered: true });
    } catch {}
  }

  // Hook IntersectionObserver for scroll-triggered animation attribution
  const origIntersectionObserver = window.IntersectionObserver;
  if (typeof origIntersectionObserver === 'function') {
    window.IntersectionObserver = function(callback, options) {
      const wrappedCallback = function(entries, observer) {
        for (let i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && entries[i].target) {
            ioTriggeredElements.add(entries[i].target);
          }
        }
        return callback.call(this, entries, observer);
      };
      return new origIntersectionObserver(wrappedCallback, options);
    };
    window.IntersectionObserver.prototype = origIntersectionObserver.prototype;
    Object.keys(origIntersectionObserver).forEach((key) => {
      window.IntersectionObserver[key] = origIntersectionObserver[key];
    });
  }

  window.addEventListener('scroll', () => {
    scrollEventCount++;
    lastScrollEventFrame = currentFrameIndex;
    isScrolling = true;
    setTimeout(() => { isScrolling = false; }, 60);
  }, { passive: true, capture: true });

  function sampleWaapiAnimations() {
      if (typeof document.getAnimations !== 'function') return;
      let list;
      try { list = document.getAnimations(); } catch { return; }
      for (const animation of list) {
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

    /**
     * A CSS/WAAPI animation only exists in document.getAnimations() while it is
     * running. Patching requestAnimationFrame alone is not enough: a page driven
     * purely by CSS never calls rAF, so its animations would never be observed.
     * A low-frequency timer poll catches short-lived animations without forcing
     * frames or polluting the rAF concurrency accounting.
     */
    setInterval(sampleWaapiAnimations, 200);

    const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    return origRAF.call(window, function(timestamp) {
      if (timestamp !== lastRafTimestamp) {
        if (currentFrameRafCount > maxConcurrentRaf) {
          maxConcurrentRaf = currentFrameRafCount;
        }
        currentFrameRafCount = 0;
        lastRafTimestamp = timestamp;
      }
      currentFrameRafCount++;

      isInsideRaf = true;
      currentFrameIndex++;
      if (isScrolling) scrollPhaseFrames.add(currentFrameIndex);
      sampleWaapiAnimations();
      if (typeof document.getAnimations === 'function') {
        sampleWaapiAnimations();
      }
      try {
        cb(timestamp);
      } finally {
        isInsideRaf = false;
      }
    });
  };

  function describeElement(el) {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    let cls = null;
    if (el.className && typeof el.className === 'string') cls = el.className;
    else if (typeof el.getAttribute === 'function') cls = el.getAttribute('class');
    if (cls) {
      const classList = cls.trim().split(/\\s+/).filter(Boolean);
      if (classList.length > 0) return tag + '.' + classList.join('.');
    }
    const parent = el.parentElement;
    if (parent) {
      const kids = parent.children;
      for (let i = 0; i < kids.length; i++) {
        if (kids[i] === el) return tag + ':nth-child(' + (i + 1) + ')';
      }
    }
    return tag;
  }

  function getSelector(el) {
    if (!el || el === window) return 'window';
    if (el === document || el.nodeType === 9) return '#document';
    if (el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    if (!(el instanceof Element)) return el.nodeName ? el.nodeName.toLowerCase() : 'window';

    const parts = [];
    let current = el;
    let depth = 0;
    while (current && current.nodeType === 1 && depth < 6) {
      const part = describeElement(current);
      if (!part) break;
      parts.unshift(part);
      if (current.id || current === document.body || current === document.documentElement) break;
      current = current.parentElement;
      depth++;
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
        hasRafOrDebounce: /\\brequestAnimationFrame\\b|\\b(?:debounce|throttle)\\b/.test(listenerSource)
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

  // Track style mutations frame-by-frame and detect layer promotion
  const COMPOSITOR_PROPS = {
    transform: true, translate: true, rotate: true, scale: true,
    opacity: true, filter: true, clipPath: true, 'clip-path': true,
    webkitTransform: true, webkitFilter: true,
    transformOrigin: true, 'transform-origin': true
  };

  const LAYOUT_PROPS = {
    width: true, height: true, top: true, left: true, right: true, bottom: true,
    margin: true, marginTop: true, marginRight: true, marginBottom: true, marginLeft: true,
    padding: true, paddingTop: true, paddingRight: true, paddingBottom: true, paddingLeft: true,
    fontSize: true, lineHeight: true
  };

  const PAINT_PROPS = {
    backgroundColor: true, 'background-color': true,
    color: true, borderColor: true, 'border-color': true,
    borderRadius: true, 'border-radius': true,
    boxShadow: true, 'box-shadow': true, outline: true, background: true
  };

  const proxyCache = new WeakMap();
  const had3dTransform = new WeakSet();
  const styleTracking = new WeakMap();

  function is3dTranslate(v) {
    return typeof v === 'string' && v !== 'none' && v.trim().split(/\\s+/).length >= 3;
  }

  function trackStyleMutation(el, prop) {
    if (!el || !prop) return;
    if (['willChange', 'will-change', 'pointerEvents', 'cursor'].includes(prop)) return;

    let propMap = styleTracking.get(el);
    if (!propMap) {
      propMap = new Map();
      styleTracking.set(el, propMap);
    }
    let frames = propMap.get(prop);
    if (!frames) {
      frames = [];
      propMap.set(prop, frames);
    }
    if (frames[frames.length - 1] !== currentFrameIndex) {
      frames.push(currentFrameIndex);
    }

    let maxConsecutive = 1;
    let currRun = 1;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i] === frames[i - 1] + 1) {
        currRun++;
        if (currRun > maxConsecutive) maxConsecutive = currRun;
      } else {
        currRun = 1;
      }
    }

    if (maxConsecutive >= 5 || frames.length >= 5) {
      const jsEntry = jsAnimatedElements.get(el) || { count: 0, props: new Set(), frames: new Set() };
      jsEntry.count = Math.max(jsEntry.count, maxConsecutive);
      jsEntry.props.add(prop);
      jsEntry.frames.add(currentFrameIndex);
      jsAnimatedElements.set(el, jsEntry);
    }
  }

  function patchStyleProto(proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'style');
    const getter = desc && desc.get ? desc.get : null;
    if (!getter) return;
    Object.defineProperty(proto, 'style', {
      get() {
        if (proxyCache.has(this)) return proxyCache.get(this);
        const realStyle = getter.call(this);
        const el = this;
        const proxy = new Proxy(realStyle, {
          set(target, prop, value) {
            if (typeof prop === 'string' && target[prop] !== value) {
              trackStyleMutation(el, prop);
              markWrite(prop, el);
              if (prop === 'transform' && typeof value === 'string' &&
                  (value.includes('translateZ') || value.includes('translate3d') || value.includes('matrix3d'))) {
                had3dTransform.add(el);
              }
              if (prop === 'translate' && is3dTranslate(value)) {
                had3dTransform.add(el);
              }
            }
            target[prop] = value;
            return true;
          },
          get(target, prop) {
            const val = target[prop];
            if (prop === 'setProperty' && typeof val === 'function') {
              return function(name, newVal) {
                if (target.getPropertyValue(name) !== String(newVal)) {
                  trackStyleMutation(el, name);
                  markWrite(name, el);
                  if (name === 'transform' && typeof newVal === 'string' &&
                      (newVal.includes('translateZ') || newVal.includes('translate3d') || newVal.includes('matrix3d'))) {
                    had3dTransform.add(el);
                  }
                  if (name === 'translate' && is3dTranslate(newVal)) {
                    had3dTransform.add(el);
                  }
                }
                return val.apply(target, arguments);
              };
            }
            if (typeof val === 'function') return val.bind(target);
            return val;
          }
        });
        proxyCache.set(this, proxy);
        return proxy;
      },
      configurable: true
    });
  }

  try {
    patchStyleProto(HTMLElement.prototype);
    if (typeof SVGElement !== 'undefined') {
      patchStyleProto(SVGElement.prototype);
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

  const rawGetComputedStyle =
    typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle
      : null;
  if (rawGetComputedStyle) {
    window.getComputedStyle = function(elt, pseudoElt) {
      recordRead('getComputedStyle', elt, 'style');
      return rawGetComputedStyle.call(this, elt, pseudoElt);
    };
  }

  // 4. JS Animation detection via native W3C MutationObserver
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

  function gradeElementPromotion(el, properties) {
    let hasWillChange = false;
    let has3dTransform = had3dTransform.has(el);
    try {
      const computed = window.getComputedStyle(el);
      const wc = computed?.willChange;
      if (wc && wc !== 'auto') {
        const wcProps = wc.split(',').map((p) => p.trim().toLowerCase());
        for (const p of wcProps) {
          if (COMPOSITOR_PROPS[p] || p === 'transform' || p === 'opacity') {
            hasWillChange = true;
            break;
          }
        }
      }
      if (!has3dTransform && computed?.transform && computed.transform !== 'none') {
        has3dTransform = computed.transform.includes('matrix3d');
      }
    } catch {}

    const isPromoted = hasWillChange || has3dTransform;
    const hasCompositorProps = properties.some((p) => COMPOSITOR_PROPS[p]);
    const hasLayoutProps = properties.some((p) => LAYOUT_PROPS[p]);
    const hasPaintProps = properties.some((p) => PAINT_PROPS[p]);

    let tier = 'S';
    const notes = [];

    if (hasLayoutProps) {
      tier = 'D';
    } else if (hasPaintProps) {
      tier = 'C';
    } else if (hasCompositorProps) {
      if (isPromoted) {
        tier = 'A';
      } else {
        // Informational only: Chrome promotes animating transform/opacity itself.
        notes.push('MISSING WILL-CHANGE');
      }
    }

    return {
      tier,
      hasWillChange,
      isPromoted,
      notes
    };
  }

  window.__MOTION_AUDIT__ = {
    getScrollData() {
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
    getThrashingBreakdown() {
      let mountCount = 0;
      let frameCount = 0;
      for (let i = 0; i < thrashingLog.length; i++) {
        if (thrashingLog[i].phase === 'init' || thrashingLog[i].frameIndex === 0) {
          mountCount++;
        } else {
          frameCount++;
        }
      }
      return {
        mountCount,
        frameCount,
        maxConcurrentRaf: Math.max(1, maxConcurrentRaf)
      };
    },
    /**
     * Marks the start of the scripted interaction phase. Frames recorded before
     * this belong to page load and are not motion.
     */
    markInteractionStart() {
      interactionStartMs = performance.now();
      return interactionStartMs;
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
    getSelector(el) {
      return getSelector(el);
    },
    getUntrackedRect(el) {
      return origGetBoundingClientRect.call(el);
    },
    getUntrackedStyle(el, pseudoElt) {
      return rawGetComputedStyle ? rawGetComputedStyle.call(window, el, pseudoElt) : null;
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
    /**
     * Animations accumulated across the whole session, not just those still
     * running at sampling time. A finite animation detaches from
     * document.getAnimations() the moment it finishes, so a single late snapshot
     * silently misses every short-lived animation on the page.
     */
    getAccumulatedWaapiAnimations() {
      isInternalRead = true;
      try {
        const results = [];
        let idx = 0;
        for (const animation of waapiAnimationFrames.keys()) {
          const effect = animation.effect;
          const target = effect && effect.target ? effect.target : null;
          if (!target) continue;
          const props = new Set();
          try {
            if (typeof effect.getKeyframes === 'function') {
              // getKeyframes() keys are the animated properties themselves in
              // Chromium; the timing fields must be excluded.
              const skip = { offset: 1, easing: 1, composite: 1, computedOffset: 1 };
              for (const kf of effect.getKeyframes()) {
                if (!kf) continue;
                for (const k of Object.keys(kf)) {
                  if (!skip[k]) props.add(k);
                }
              }
            }
          } catch {}
          if (props.size === 0) continue;
          const properties = Array.from(props);
          const timing = typeof effect.getTiming === 'function' ? effect.getTiming() : null;
          const dur = timing && Number.isFinite(timing.duration) ? Number(timing.duration) : 300;
          const iterations = timing && Number.isFinite(timing.iterations) ? Number(timing.iterations) : 1;
          const timelineName = animation.timeline && animation.timeline.constructor ? animation.timeline.constructor.name : '';
          let rect = { width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 };
          try {
            if (typeof target.getBoundingClientRect === 'function') {
              rect = target.getBoundingClientRect();
            }
          } catch {}
          const vpW = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 1000);
          const vpH = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 1000);
          const buffer = 400;
          const isOffscreen = rect.bottom <= -buffer || rect.top >= vpH + buffer || rect.right <= -buffer || rect.left >= vpW + buffer;
          const graded = gradeElementPromotion(target, properties);
          results.push({
            id: 'waapi-anim-' + (idx++),
            selector: getSelector(target),
            properties,
            source: animation.id && animation.id.indexOf('css') === 0 ? 'css-animation' : 'waapi',
            durationMs: dur,
            iterations,
            paintArea: Math.max(100, (rect.width || 100) * (rect.height || 100)),
            isOffscreen,
            tier: graded.tier,
            hasWillChange: graded.hasWillChange,
            isPromoted: graded.isPromoted,
            notes: graded.notes,
            kind: timelineName === 'ScrollTimeline' || timelineName === 'ViewTimeline' ? 'scroll-linked' : 'waapi',
            trigger: undefined
          });
        }
        return results;
      } finally {
        isInternalRead = false;
      }
    },
    getJsAnimations() {
      isInternalRead = true;
      try {
        const results = [];
        let idx = 0;
        for (const [el, data] of jsAnimatedElements.entries()) {
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
            const properties = Array.from(data.props);
            const graded = gradeElementPromotion(el, properties);
            const isTriggeredByScroll = ioTriggeredElements.has(el) || (isScrolling && frameCount > 0);

            results.push({
              id: 'js-anim-' + (idx++),
              selector: getSelector(el),
              properties,
              source: 'js-loop',
              durationMs: 600,
              iterations: Infinity,
              paintArea: Math.max(100, (rect.width || 100) * (rect.height || 100)),
              isOffscreen,
              frameCount: Math.max(frameCount, data.count),
              frames: Array.from(data.frames || []),
              tier: graded.tier,
              hasWillChange: graded.hasWillChange,
              isPromoted: graded.isPromoted,
              notes: graded.notes,
              kind: isTriggeredByScroll ? 'scroll-triggered' : 'javascript',
              trigger: ioTriggeredElements.has(el) ? 'IntersectionObserver' : (isScrolling ? 'Scroll event' : undefined)
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
