import { OG_PALETTE } from "@workspace/ui/components/og/palette";

import type { OgPageContent } from "@/lib/og/resolve-og-page";
import { OG_FONT_FAMILY } from "@/lib/og/sf-pro-display-font";
import { OgMotionAuditBrand } from "@/lib/og/sora-ui-brand";
import { SITE_URL } from "@/lib/site";

export function OgImageFrame({ title, description }: OgPageContent) {
  return (
    <div
      style={{ backgroundColor: OG_PALETTE.background }}
      tw="relative flex w-full h-full"
    >
      <div
        style={{ backgroundColor: OG_PALETTE.borderSubtle }}
        tw="absolute left-15 top-0 bottom-0 w-0.5 h-full"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderSubtle }}
        tw="absolute right-15 top-0 bottom-0 w-0.5 h-full"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderSubtle }}
        tw="absolute bottom-15 left-0 right-0 w-full h-0.5"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderSubtle }}
        tw="absolute top-15 left-0 right-0 w-full h-0.5"
      />

      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute top-15 left-[43.5px] w-[35px] h-0.5"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute left-15 top-[43.5px] h-[35px] w-0.5"
      />

      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute bottom-15 left-[43.5px] w-[35px] h-0.5"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute left-15 bottom-[43.5px] h-[35px] w-0.5"
      />

      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute top-15 right-[43.5px] w-[35px] h-0.5"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute right-15 top-[43.5px] h-[35px] w-0.5"
      />

      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute bottom-15 right-[43.5px] w-[35px] h-0.5"
      />
      <div
        style={{ backgroundColor: OG_PALETTE.borderMuted }}
        tw="absolute right-15 bottom-[43.5px] h-[35px] w-0.5"
      />

      <div
        style={{
          backgroundSize: "100px 100px",
          padding: "88px 96px",
        }}
        tw="flex flex-col w-full h-full items-start justify-between"
      >
        <div tw="flex flex-row items-center">
          <svg
            aria-hidden="true"
            fill="#fff"
            height="52"
            viewBox="0 0 200 200"
            width="52"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="translate(100 100) scale(0.8292) translate(-100 -100)">
              <path d="M 150.245 -0.676 L 150.658 49.581 L 49.237 49.477 L 49.714 -0.758 L 150.245 -0.676 Z M 49.342 150.419 L 49.237 49.477 L -1.04 49.794 L -1.304 150.337 L 49.342 150.419 Z M 150.763 150.523 L 150.658 49.581 L 201.304 49.663 L 201.04 150.206 L 150.763 150.523 Z M 150.763 150.523 L 49.342 150.419 L 49.755 200.676 L 150.286 200.758 L 150.763 150.523 Z" />
            </g>
          </svg>
          <p
            style={{ fontFamily: OG_FONT_FAMILY, marginLeft: 16 }}
            tw="text-white text-5xl font-medium"
          >
            Motion Audit
          </p>
        </div>

        <div tw="flex flex-row w-full justify-between items-end">
          <div style={{ maxWidth: 680 }} tw="flex flex-col flex-1">
            <p
              style={{ fontFamily: OG_FONT_FAMILY }}
              tw="text-white text-6xl font-medium mb-0"
            >
              {title}
            </p>
            {description ? (
              <p
                style={{ fontFamily: OG_FONT_FAMILY }}
                tw="text-white/60 text-2xl mt-6 -mb-2"
              >
                {description}
              </p>
            ) : null}
          </div>

          <div style={{ flexShrink: 0 }} tw="flex">
            <p
              style={{ fontFamily: OG_FONT_FAMILY }}
              tw="text-white/80 text-2xl -mb-2"
            >
              {new URL(SITE_URL).host}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
