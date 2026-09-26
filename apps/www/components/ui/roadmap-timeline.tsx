"use client";

import { cn } from "@workspace/ui/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  Flame,
  Search,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

export type ComponentStatus =
  | "completed"
  | "in-progress"
  | "planned"
  | "under-consideration";
export type Framework = "react" | "vue" | "js";
export type MotionScore = "S" | "A" | "B" | "C";

export interface RoadmapItem {
  category:
    | "base-ui"
    | "rtl-support"
    | "radix-ui"
    | "other-headless"
    | "cross-platform";
  categoryLabel: string;
  description: string;
  docUrl?: string;
  frameworks: Framework[];
  id: string;
  motionScore?: MotionScore;
  name: string;
  phase: number;
  priority?: "High" | "Medium" | "Planned";
  scoreValue?: number;
  status: ComponentStatus;
  tags?: string[];
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  // Phase 1: Base UI (Highest Priority - 14 Core Components)
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Accessible button with physics-based spring scaling on hover/tap and CVA variants.",
    docUrl: "/ui/base/button",
    frameworks: ["react"],
    id: "base-button",
    motionScore: "S",
    name: "Base UI: Button",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Core", "Spring Scaling", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Animated checkbox with SVG path morphing checkmark and elastic pop feedback.",
    docUrl: "/ui/base/checkbox",
    frameworks: ["react"],
    id: "base-checkbox",
    motionScore: "S",
    name: "Base UI: Checkbox",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Forms", "Path Morph", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Native input with familiar shadcn/ui styling and a Motion-powered caret.",
    docUrl: "/ui/base/input",
    frameworks: ["react"],
    id: "base-input",
    motionScore: "B",
    name: "Base UI: Input",
    phase: 1,
    priority: "High",
    scoreValue: 3,
    status: "completed",
    tags: ["Forms", "Caret Motion", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Modal dialog with backdrop blur fade and scale-in spring transition.",
    docUrl: "/ui/base/dialog",
    frameworks: ["react"],
    id: "base-dialog",
    motionScore: "S",
    name: "Base UI: Dialog",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "Scale Spring", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Accessible alert dialog modal with 3D perspective spring transitions, customizable size variants, and media slot.",
    docUrl: "/ui/base/alert-dialog",
    frameworks: ["react"],
    id: "base-alert-dialog",
    motionScore: "S",
    name: "Base UI: Alert dialog",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "3D Perspective", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Smooth height layout animation with rotating chevron and keyboard navigation.",
    docUrl: "/ui/base/accordion",
    frameworks: ["react"],
    id: "base-accordion",
    motionScore: "S",
    name: "Base UI: Accordion",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Disclosure", "Height Morph", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Context menu with spring scale physics, cascaded submenus, and checkable items.",
    docUrl: "/ui/base/context-menu",
    frameworks: ["react"],
    id: "base-context-menu",
    motionScore: "S",
    name: "Base UI: Context menu",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Navigation", "Spring Scale", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Collision-aware floating dropdown with spring scale physics, cascaded submenus, and checkable items.",
    docUrl: "/ui/base/dropdown-menu",
    frameworks: ["react"],
    id: "base-dropdown-menu",
    motionScore: "S",
    name: "Base UI: Dropdown menu",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Navigation", "Spring Scale", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Elastic filling progress bar with smooth indeterminate shimmer and numeric ticker.",
    frameworks: ["react"],
    id: "base-progress",
    motionScore: "B",
    name: "Base UI: Progress",
    phase: 1,
    priority: "High",
    scoreValue: 3,
    status: "in-progress",
    tags: ["Feedback", "Elastic", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Radio group with shared layoutId gliding active circle indicator.",
    frameworks: ["react"],
    id: "base-radio",
    motionScore: "A",
    name: "Base UI: Radio",
    phase: 1,
    priority: "High",
    scoreValue: 4,
    status: "planned",
    tags: ["Forms", "Layout Morph", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Animated select combobox dropdown with floating active pill and filter transitions.",
    frameworks: ["react"],
    id: "base-select",
    motionScore: "S",
    name: "Base UI: Select",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "planned",
    tags: ["Forms", "Floating UI", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Toggle switch with Motion spring layout physics, size variants, and track icon slots.",
    docUrl: "/ui/base/switch",
    frameworks: ["react"],
    id: "base-switch",
    motionScore: "S",
    name: "Base UI: Switch",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Forms", "Spring Layout", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Sliding background indicator pill with cross-fading tab panels.",
    frameworks: ["react"],
    id: "base-tabs",
    motionScore: "S",
    name: "Base UI: Tabs",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "planned",
    tags: ["Navigation", "Shared Layout", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Stacked toast notification queue with interactive swipe-to-dismiss gesture physics.",
    frameworks: ["react"],
    id: "base-toast",
    motionScore: "S",
    name: "Base UI: Toast",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "planned",
    tags: ["Feedback", "Swipe Gesture", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Multi-item toggle group with morphing border bounds and tactile feedback.",
    frameworks: ["react"],
    id: "base-toggle-group",
    motionScore: "A",
    name: "Base UI: Toggle group",
    phase: 1,
    priority: "High",
    scoreValue: 4,
    status: "planned",
    tags: ["Buttons", "Morphing", "Base UI"],
  },
  {
    category: "base-ui",
    categoryLabel: "Base UI",
    description:
      "Micro scale-fade tooltip with dynamic arrow position tracking and spring entrance physics.",
    docUrl: "/ui/base/tooltip",
    frameworks: ["react"],
    id: "base-tooltip",
    motionScore: "S",
    name: "Base UI: Tooltip",
    phase: 1,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "Micro Animation", "Base UI"],
  },

  // Phase 2: RTL Support & Existing Registry Retrofit (Immediate Next Priority)
  {
    category: "rtl-support",
    categoryLabel: "RTL Support",
    description:
      "Prioritized RTL retrofitting across all existing components in the registry (Base UI suite, Radix UI suite, and Motion Primitives).",
    frameworks: ["react"],
    id: "rtl-registry-retrofit",
    motionScore: "S",
    name: "RTL: Existing Registry Retrofit",
    phase: 2,
    priority: "High",
    scoreValue: 5,
    status: "in-progress",
    tags: ["RTL", "Retrofit", "Core", "Registry"],
  },
  {
    category: "rtl-support",
    categoryLabel: "RTL Support",
    description:
      "Automatic motion mirroring and directional spring physics: dynamic inverted X-axis transforms, swipe-to-dismiss, and drawer gesture flings.",
    frameworks: ["react"],
    id: "rtl-directional-physics",
    motionScore: "S",
    name: "RTL: Directional Spring Physics & Gestures",
    phase: 2,
    priority: "High",
    scoreValue: 5,
    status: "planned",
    tags: ["RTL", "Directional Physics", "Motion"],
  },
  {
    category: "rtl-support",
    categoryLabel: "RTL Support",
    description:
      "Standardizing Tailwind CSS logical utilities (start/end, ps/pe, ms/me, border-s/border-e) across all registry templates.",
    frameworks: ["react"],
    id: "rtl-logical-properties",
    motionScore: "A",
    name: "RTL: CSS Logical Properties Standardization",
    phase: 2,
    priority: "High",
    scoreValue: 4,
    status: "planned",
    tags: ["RTL", "Tailwind CSS", "Logical Properties"],
  },
  {
    category: "rtl-support",
    categoryLabel: "RTL Support",
    description:
      "Collision-aware right-to-left cascading submenus, popover anchor realignment, and dynamic arrow direction for context & dropdown menus.",
    frameworks: ["react"],
    id: "rtl-floating-submenus",
    motionScore: "S",
    name: "RTL: Floating Elements & Submenu Flipping",
    phase: 2,
    priority: "High",
    scoreValue: 5,
    status: "planned",
    tags: ["RTL", "Floating UI", "Menus", "Popovers"],
  },

  // Phase 3: Radix UI (Priority 3 - 15+ Components)
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description: "Radix primitive slot button with Motion hover scale physics.",
    docUrl: "/ui/radix/button",
    frameworks: ["react"],
    id: "radix-button",
    motionScore: "S",
    name: "Radix: Button",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Core", "Spring Scaling", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description: "Radix checkbox with animated check icon path and focus ring.",
    docUrl: "/ui/radix/checkbox",
    frameworks: ["react"],
    id: "radix-checkbox",
    motionScore: "S",
    name: "Radix: Checkbox",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Forms", "Path Morph", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Native input with shadcn/ui styling and a Motion-powered caret.",
    docUrl: "/ui/radix/input",
    frameworks: ["react"],
    id: "radix-input",
    motionScore: "B",
    name: "Radix: Input",
    phase: 3,
    priority: "High",
    scoreValue: 3,
    status: "completed",
    tags: ["Forms", "Caret Motion", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description: "Radix dialog modal overlay with spring entrance animation.",
    docUrl: "/ui/radix/dialog",
    frameworks: ["react"],
    id: "radix-dialog",
    motionScore: "S",
    name: "Radix: Dialog",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "Spring Scale", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Accessible alert dialog modal with 3D perspective spring transitions and media slot.",
    docUrl: "/ui/radix/alert-dialog",
    frameworks: ["react"],
    id: "radix-alert-dialog",
    motionScore: "S",
    name: "Radix: Alert dialog",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "3D Perspective", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Radix accordion with smooth collapsible height animation and rotating chevron.",
    docUrl: "/ui/radix/accordion",
    frameworks: ["react"],
    id: "radix-accordion",
    motionScore: "S",
    name: "Radix: Accordion",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Disclosure", "Height Morph", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Radix context menu with spring scale physics, cascaded submenus, and checkable items.",
    docUrl: "/ui/radix/context-menu",
    frameworks: ["react"],
    id: "radix-context-menu",
    motionScore: "S",
    name: "Radix: Context menu",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Navigation", "Spring Scale", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Collision-aware floating dropdown menu with spring scale physics and cascaded submenus.",
    docUrl: "/ui/radix/dropdown-menu",
    frameworks: ["react"],
    id: "radix-dropdown-menu",
    motionScore: "S",
    name: "Radix: Dropdown menu",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Navigation", "Spring Scale", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Toggle switch with Motion spring layout physics, size variants, and track icon slots.",
    docUrl: "/ui/radix/switch",
    frameworks: ["react"],
    id: "radix-switch",
    motionScore: "S",
    name: "Radix: Switch",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Forms", "Spring Layout", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Micro scale-fade tooltip with dynamic arrow position tracking and spring entrance physics.",
    docUrl: "/ui/radix/tooltip",
    frameworks: ["react"],
    id: "radix-tooltip",
    motionScore: "S",
    name: "Radix: Tooltip",
    phase: 3,
    priority: "High",
    scoreValue: 5,
    status: "completed",
    tags: ["Overlays", "Micro Animation", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Mobile-first draggable bottom sheet drawer with inertia fling dismiss (Redesign planned).",
    frameworks: ["react"],
    id: "radix-bottom-sheet",
    motionScore: "S",
    name: "Radix: Bottom Sheet",
    phase: 3,
    priority: "Medium",
    scoreValue: 5,
    status: "planned",
    tags: ["Drawer", "Gestures", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description: "Floating popovers with directional micro spring transitions.",
    frameworks: ["react"],
    id: "radix-popover-hovercard",
    motionScore: "A",
    name: "Radix: Popover & Hover Card",
    phase: 3,
    priority: "Medium",
    scoreValue: 4,
    status: "planned",
    tags: ["Overlays", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Interactive controls with shared layout sliding indicator and drag physics.",
    frameworks: ["react"],
    id: "radix-tabs-slider",
    motionScore: "S",
    name: "Radix: Tabs & Slider",
    phase: 3,
    priority: "Medium",
    scoreValue: 5,
    status: "planned",
    tags: ["Controls", "Radix UI"],
  },
  {
    category: "radix-ui",
    categoryLabel: "Radix UI",
    description:
      "Accessible notification queue with interactive gesture physics.",
    frameworks: ["react"],
    id: "radix-toast",
    motionScore: "A",
    name: "Radix: Toast",
    phase: 3,
    priority: "Medium",
    scoreValue: 4,
    status: "planned",
    tags: ["Feedback", "Radix UI"],
  },

  // Phase 4: Other Headless UI Libraries (Planned)
  {
    category: "other-headless",
    categoryLabel: "Other Headless UI",
    description:
      "Adobe's enterprise-grade accessible components infused with Sora Motion spring physics.",
    frameworks: ["react"],
    id: "react-aria-suite",
    motionScore: "S",
    name: "React Aria Components Integration",
    phase: 4,
    priority: "Planned",
    scoreValue: 5,
    status: "planned",
    tags: ["React Aria", "Headless", "Accessibility"],
  },
  {
    category: "other-headless",
    categoryLabel: "Other Headless UI",
    description:
      "State machine-driven headless components with universal motion presets.",
    frameworks: ["react", "vue"],
    id: "ark-ui-suite",
    motionScore: "A",
    name: "Ark UI (Zag.js) Adapter",
    phase: 4,
    priority: "Planned",
    scoreValue: 4,
    status: "under-consideration",
    tags: ["Ark UI", "Zag.js", "Multi-Framework"],
  },
  {
    category: "other-headless",
    categoryLabel: "Other Headless UI",
    description:
      "Clean adapters for Tailwind Headless UI and Ariakit primitives.",
    frameworks: ["react"],
    id: "headless-ui-ariakit",
    motionScore: "B",
    name: "Ariakit & Headless UI Modules",
    phase: 4,
    priority: "Planned",
    scoreValue: 3,
    status: "under-consideration",
    tags: ["Ariakit", "Headless UI"],
  },

  // Phase 5: Cross-Platform & Ecosystem
  {
    category: "cross-platform",
    categoryLabel: "Cross-Platform",
    description:
      "Dedicated component ports for Vue 3 (Motion for Vue) and vanilla JS web components.",
    frameworks: ["vue", "js"],
    id: "multi-platform-expansion",
    motionScore: "A",
    name: "Multi-Platform: Vue 3 & Vanilla JavaScript",
    phase: 5,
    priority: "Planned",
    scoreValue: 4,
    status: "planned",
    tags: ["Vue 3", "Vanilla JS", "Cross-Platform"],
  },
];

const MOTIONSCORE_BENCHMARKS = [
  {
    color:
      "border-[oklch(0.88_0.18_96)/40] bg-[oklch(0.88_0.18_96)/10] text-[#b88600] dark:text-[oklch(0.88_0.18_96)]",
    count: 6,
    description:
      "Animations run entirely on the GPU compositor thread (transform, opacity). Zero main-thread interruption.",
    label: "S-Tier • Compositor Only",
    tier: "S",
  },
  {
    color:
      "border-[oklch(0.76_0.15_155)/40] bg-[oklch(0.76_0.15_155)/10] text-emerald-600 dark:text-[oklch(0.76_0.15_155)]",
    count: 2,
    description:
      "Animations change composited values from the main thread with smooth micro-interaction orchestration.",
    label: "A-Tier • Main-Thread Composited",
    tier: "A",
  },
  {
    color:
      "border-[oklch(0.68_0.18_255)/40] bg-[oklch(0.68_0.18_255)/10] text-blue-600 dark:text-[oklch(0.68_0.18_255)]",
    count: 3,
    description:
      "S or A-tier animations requiring upfront DOM measurements (e.g. FLIP layout morphing, elastic progress).",
    label: "B-Tier • Measured Animation",
    tier: "B",
  },
  {
    color:
      "border-[oklch(0.64_0.18_302)/40] bg-[oklch(0.64_0.18_302)/10] text-purple-600 dark:text-[oklch(0.64_0.18_302)]",
    count: 3,
    description:
      "Animations trigger paint operations (colors, shadows, SVG paths, and theme transitions).",
    label: "C-Tier • Paint Triggering",
    tier: "C",
  },
  {
    color:
      "border-[oklch(0.67_0.22_26.43)/40] bg-[oklch(0.67_0.22_26.43)/10] text-red-600 dark:text-[oklch(0.67_0.22_26.43)]",
    count: 0,
    description:
      "Zero tolerance in Sora UI: No layout recalculations or synchronous DOM thrashing allowed.",
    label: "D/F • Layout & Thrashing (0%)",
    tier: "D / F",
  },
];

function getStatusLabel(status: ComponentStatus): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "in-progress") {
    return "In Progress";
  }
  return "Planned";
}

function StatusNodeIcon({ status }: { status: ComponentStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-3 md:size-3.5" />;
  }
  if (status === "in-progress") {
    return <Flame className="size-3 md:size-3.5" />;
  }
  return <Clock className="size-3 md:size-3.5" />;
}

function RoadmapCard({
  item,
  index,
  shouldReduceMotion,
}: {
  item: RoadmapItem;
  index: number;
  shouldReduceMotion: boolean | null;
}) {
  const isCompleted = item.status === "completed";
  const isInProgress = item.status === "in-progress";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex w-full min-w-0 flex-col gap-3 rounded-xl border bg-card/60 p-4 transition-all duration-200 hover:border-foreground/30 hover:bg-card md:p-5"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      key={item.id}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              isCompleted &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              isInProgress &&
                "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
              !(isCompleted || isInProgress) &&
                "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            <StatusNodeIcon status={item.status} />
          </span>
          <span className="font-semibold text-foreground text-sm tracking-tight sm:text-base">
            {item.name}
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-medium text-[11px]",
              isCompleted &&
                "border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              isInProgress &&
                "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
              !(isCompleted || isInProgress) && "bg-muted text-muted-foreground"
            )}
          >
            {getStatusLabel(item.status)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
          {item.frameworks.map((fw) => (
            <span
              className="rounded border bg-accent/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase"
              key={fw}
            >
              {fw}
            </span>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        {item.description}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded border bg-accent/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            Phase {item.phase} • {item.categoryLabel}
          </span>
          {item.tags?.map((tag) => (
            <span
              className="rounded bg-accent/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              key={tag}
            >
              #{tag}
            </span>
          ))}
        </div>

        {item.docUrl && (
          <Link
            className="inline-flex items-center gap-1 font-medium text-primary text-xs hover:underline"
            href={item.docUrl}
          >
            <span>View Documentation</span>
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export function RoadmapTimeline() {
  const shouldReduceMotion = useReducedMotion();
  const searchInputId = useId();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<string>("all");
  const [activeFramework, setActiveFramework] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredItems = useMemo(
    () =>
      ROADMAP_ITEMS.filter((item) => {
        if (activeCategory !== "all" && item.category !== activeCategory) {
          return false;
        }
        if (activeStatus !== "all" && item.status !== activeStatus) {
          return false;
        }
        if (
          activeFramework !== "all" &&
          !item.frameworks.includes(activeFramework as Framework)
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesDesc = item.description.toLowerCase().includes(q);
          const matchesTags = item.tags?.some((t) =>
            t.toLowerCase().includes(q)
          );
          const matchesCategory = item.categoryLabel.toLowerCase().includes(q);
          if (!(matchesName || matchesDesc || matchesTags || matchesCategory)) {
            return false;
          }
        }
        return true;
      }),
    [activeCategory, activeStatus, activeFramework, searchQuery]
  );

  const stats = useMemo(() => {
    const total = ROADMAP_ITEMS.length;
    const completed = ROADMAP_ITEMS.filter(
      (i) => i.status === "completed"
    ).length;
    const inProgress = ROADMAP_ITEMS.filter(
      (i) => i.status === "in-progress"
    ).length;
    const planned = ROADMAP_ITEMS.filter(
      (i) => i.status === "planned" || i.status === "under-consideration"
    ).length;
    const baseUiTotal = ROADMAP_ITEMS.filter(
      (i) => i.category === "base-ui"
    ).length;
    const baseUiCompleted = ROADMAP_ITEMS.filter(
      (i) => i.category === "base-ui" && i.status === "completed"
    ).length;
    const rtlTotal = ROADMAP_ITEMS.filter(
      (i) => i.category === "rtl-support"
    ).length;
    const rtlCompleted = ROADMAP_ITEMS.filter(
      (i) => i.category === "rtl-support" && i.status === "completed"
    ).length;
    const rtlInProgress = ROADMAP_ITEMS.filter(
      (i) => i.category === "rtl-support" && i.status === "in-progress"
    ).length;
    const radixUiTotal = ROADMAP_ITEMS.filter(
      (i) => i.category === "radix-ui"
    ).length;
    const radixUiCompleted = ROADMAP_ITEMS.filter(
      (i) => i.category === "radix-ui" && i.status === "completed"
    ).length;
    return {
      baseUiCompleted,
      baseUiTotal,
      completed,
      inProgress,
      planned,
      radixUiCompleted,
      radixUiTotal,
      rtlCompleted,
      rtlInProgress,
      rtlTotal,
      total,
    };
  }, []);

  return (
    <div className="not-prose my-8 flex flex-col gap-10">
      {/* Priority Strategy Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/30 p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
              <Sparkles className="size-3.5" /> Release Strategy & Priority
            </span>
            <span className="font-mono text-muted-foreground text-xs">
              Phase 1: Base UI • Phase 2: RTL Support • Phase 3: Radix UI
            </span>
          </div>

          <div>
            <h3 className="font-semibold text-2xl text-foreground tracking-tight">
              Base UI Foundation, RTL Support Next, Multi-Headless Architecture
            </h3>
            <p className="mt-2 max-w-3xl text-muted-foreground text-sm leading-relaxed">
              We are completing all{" "}
              <strong>13 core Base UI animated components</strong>, followed by{" "}
              <strong>Phase 2: Comprehensive RTL Support</strong> prioritizing
              retrofitting all existing registry components. Radix UI animation
              primitives and multi-framework expansions follow.
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-muted-foreground text-xs">
                Base UI Progress (Phase 1)
              </div>
              <div className="mt-1 font-bold text-foreground text-xl">
                {stats.baseUiCompleted} / {stats.baseUiTotal}
                <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                  (
                  {Math.round(
                    (stats.baseUiCompleted / stats.baseUiTotal) * 100
                  )}
                  %)
                </span>
              </div>
            </div>
            <div className="rounded-xl border bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-muted-foreground text-xs">
                RTL Support (Phase 2)
              </div>
              <div className="mt-1 font-bold text-foreground text-xl">
                {stats.rtlCompleted} / {stats.rtlTotal}
                <span className="ml-1.5 font-semibold text-amber-500 text-xs">
                  (Next Focus)
                </span>
              </div>
            </div>
            <div className="rounded-xl border bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-muted-foreground text-xs">
                Radix UI Suite (Phase 3)
              </div>
              <div className="mt-1 font-bold text-foreground text-xl">
                {stats.radixUiCompleted} / {stats.radixUiTotal}
              </div>
            </div>
            <div className="rounded-xl border bg-background/60 p-3.5 backdrop-blur-sm">
              <div className="text-muted-foreground text-xs">Open Source</div>
              <div className="mt-1 font-bold text-emerald-500 text-xl">
                100% Free / MIT
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MotionScore Benchmark Section */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold text-foreground text-lg">
            MotionScore™ Quality Framework
          </h3>
          <p className="text-muted-foreground text-xs">
            Every Sora UI component is benchmarked against strict physics,
            accessibility, and performance metrics.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {MOTIONSCORE_BENCHMARKS.map((benchmark, index) => (
            <div
              className={cn(
                "flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:border-foreground/30",
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                index === 4 && "sm:col-span-2 lg:col-span-3",
                benchmark.color
              )}
              key={benchmark.tier}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-black text-2xl tracking-tighter">
                    {benchmark.tier}
                  </span>
                  <span className="rounded-md border bg-background/80 px-2 py-0.5 font-mono text-xs">
                    Tier {benchmark.tier}
                  </span>
                </div>
                <div className="mt-2 font-semibold text-sm">
                  {benchmark.label}
                </div>
              </div>
              <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
                {benchmark.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="flex flex-col gap-4 rounded-xl border bg-accent/20 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-lg border bg-background py-2 pr-4 pl-9 text-foreground text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              id={searchInputId}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components (e.g. Accordion, Dialog, Tabs, Switch)..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                aria-label="Clear search query"
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 font-medium text-muted-foreground text-xs">
              <Filter className="size-3" /> Status:
            </span>
            {(
              [
                { label: "All", value: "all" },
                { label: "Completed", value: "completed" },
                { label: "In Progress", value: "in-progress" },
                { label: "Planned", value: "planned" },
              ] as const
            ).map((status) => (
              <button
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  activeStatus === status.value
                    ? "bg-foreground font-medium text-background"
                    : "bg-background/80 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                key={status.value}
                onClick={() => setActiveStatus(status.value)}
                type="button"
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
          <span className="mr-1 text-muted-foreground text-xs">Category:</span>
          {(
            [
              { label: "All UI Components", value: "all" },
              { label: "Phase 1: Base UI", value: "base-ui" },
              { label: "Phase 2: RTL Support", value: "rtl-support" },
              { label: "Phase 3: Radix UI", value: "radix-ui" },
              { label: "Phase 4: Other Headless", value: "other-headless" },
              { label: "Phase 5: Cross-Platform", value: "cross-platform" },
            ] as const
          ).map((cat) => (
            <button
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                activeCategory === cat.value
                  ? "border-primary bg-primary font-medium text-primary-foreground"
                  : "border-transparent bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              type="button"
            >
              {cat.label}
            </button>
          ))}

          {/* Platform chips */}
          <div className="ml-auto flex items-center gap-1 pt-1 sm:pt-0">
            <span className="mr-1 text-muted-foreground text-xs">
              Platform:
            </span>
            {(
              [
                { label: "All", value: "all" },
                { label: "React", value: "react" },
                { label: "Vue", value: "vue" },
                { label: "JS", value: "js" },
              ] as const
            ).map((plat) => (
              <button
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-xs transition-colors",
                  activeFramework === plat.value
                    ? "bg-foreground font-semibold text-background"
                    : "bg-accent/60 text-muted-foreground hover:text-foreground"
                )}
                key={plat.value}
                onClick={() => setActiveFramework(plat.value)}
                type="button"
              >
                {plat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Components List */}
      <div className="flex w-full min-w-0 flex-col gap-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center text-muted-foreground text-sm">
            No components match your search and filter criteria. Try resetting
            filters.
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <RoadmapCard
              index={index}
              item={item}
              key={item.id}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))
        )}
      </div>

      {/* 100% Free & Open Source Banner */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-neutral-900 to-neutral-950 p-6 text-white md:p-8 dark:border-neutral-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-300 text-xs">
              <Sparkles className="size-3.5" /> 100% Free & Open Source
            </div>
            <h4 className="font-bold text-xl tracking-tight">
              Free forever • MIT Licensed • Community Driven
            </h4>
            <p className="max-w-2xl text-neutral-300 text-sm leading-relaxed">
              Every Base UI, Radix UI, and Motion primitive is completely free
              to use in personal and commercial projects. Copy-paste source code
              directly into your app.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 font-medium text-neutral-950 text-sm shadow-sm transition-colors hover:bg-neutral-200"
              href="/catalog"
            >
              Explore Catalog
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
