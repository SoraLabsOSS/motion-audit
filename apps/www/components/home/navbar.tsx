"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { usePageTransition } from "@/components/page-transition/page-transition-provider";

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase);
  try {
    CustomEase.create("ease-transition", "0.22, 1, 0.36, 1");
  } catch {
    // CustomEase already registered
  }
}

const ARROW_PATH =
  "M8.90954 9.09046L9 3L2.90954 3.09046L2.90213 4.32367L6.86437 4.25391L2.55914 8.55914L3.44086 9.44086L7.74609 5.13563L7.68708 9.10862L8.90954 9.09046Z";

const SoraMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 200 200"
    width="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(100 100) scale(0.8292) translate(-100 -100)">
      <path d="M150.245 -0.676 L150.658 49.581 L49.237 49.477 L49.714 -0.758 Z" />
      <path d="M49.342 150.419 L49.237 49.477 L-1.04 49.794 L-1.304 150.337 Z" />
      <path d="M150.763 150.523 L150.658 49.581 L201.304 49.663 L201.04 150.206 Z" />
      <path d="M150.763 150.523 L49.342 150.419 L49.755 200.676 L150.286 200.758 Z" />
    </g>
  </svg>
);

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/methodology", label: "Methodology" },
] as const;

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { transitionTo } = usePageTransition();
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    setIsMenuOpen(false);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    void transitionTo(href, "commercial");
  };

  useEffect(() => {
    const container = menuContainerRef.current;
    if (!container) {
      return;
    }

    const menuContain = container.querySelector<HTMLElement>(".menu_contain");
    const closeButton = container.querySelector<HTMLElement>(
      ".menu_overlay_close"
    );
    const navItems = container.querySelectorAll(".footer_nav_li");

    if (!menuContain || !closeButton) {
      return;
    }

    gsap.set(menuContain, { autoAlpha: 1, yPercent: -100 });
    gsap.set(closeButton, { autoAlpha: 0, pointerEvents: "none" });
    gsap.set(navItems, { autoAlpha: 0, yPercent: 20 });

    const timeline = gsap.timeline({
      defaults: { ease: "ease-transition" },
      onReverseComplete: () => {
        closeButton.style.pointerEvents = "none";
      },
      onStart: () => {
        closeButton.style.pointerEvents = "auto";
      },
      paused: true,
    });

    timeline
      .to(menuContain, { duration: 1.075, yPercent: 0 })
      .to(closeButton, { autoAlpha: 1, duration: 0.65 }, "<")
      .to(
        navItems,
        {
          autoAlpha: 1,
          duration: 0.65,
          stagger: { each: 0.05, from: "start" },
          yPercent: 0,
        },
        "<0.15"
      );

    timelineRef.current = timeline;

    return () => {
      timeline.kill();
      timelineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.dataset.navigationStatus = "is-open";
      document.documentElement.style.overflow = "hidden";
      timelineRef.current?.timeScale(1).play();
    } else {
      document.body.dataset.navigationStatus = "is-closed";
      document.documentElement.style.overflow = "";
      timelineRef.current?.timeScale(1.075 / 0.65).reverse();
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      delete document.body.dataset.navigationStatus;
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <>
      <header
        className="navbar_wrap"
        data-nav-bar-height=""
        data-navigation-status={isMenuOpen ? "is-open" : "is-closed"}
        data-theme-nav="dark"
      >
        <div className="navbar_contain u-grid-custom">
          <div className="navbar_left_contain">
            <Link
              aria-label="Soralabs home"
              className="navbar_home"
              href="/"
              onClick={(e) => handleLinkClick(e, "/")}
            >
              <SoraMark className="navbar_home_svg" />
            </Link>
          </div>

          <nav className="navbar_links">
            <ul className="navbar_links_ul u-gap-small u-hflex-left-center">
              {NAV_LINKS.map((link) => (
                <li className="navbar_links_li" key={link.href}>
                  <Link
                    className="navbar_link"
                    data-link-hover=""
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                  >
                    <div className="footer_nav_span type-main">
                      {link.label}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="navbar_cta_wrap type-small u-text-trim-off">
            <div className="navbar_cta_contain">
              <Link
                className="btn_main"
                data-btn-default=""
                href="/docs"
                onClick={(e) => handleLinkClick(e, "/docs")}
              >
                <div className="btn_text_contain">
                  <div className="btn_text type-small u-text-trim-off">
                    Sign in
                  </div>
                </div>
                <div className="btn_aside_wrap">
                  <div className="btn_aside_bg" />
                  <svg
                    aria-hidden="true"
                    className="btn_svg"
                    fill="none"
                    viewBox="0 0 12 12"
                    width="100%"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d={ARROW_PATH} fill="currentColor" />
                  </svg>
                  <svg
                    aria-hidden="true"
                    className="btn_svg is-absolute"
                    fill="none"
                    viewBox="0 0 12 12"
                    width="100%"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d={ARROW_PATH} fill="currentColor" />
                  </svg>
                </div>
              </Link>
            </div>
            <button
              aria-label="Toggle navigation menu"
              className="navbar_menu_btn"
              data-menu-btn=""
              onClick={() => setIsMenuOpen((prev) => !prev)}
              type="button"
            >
              <span className="navbar_menu_span-wrap">
                <span className="navbar_menu_span">Menu</span>
                <span className="navbar_menu_span is-close">Close</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="menu_wrap" ref={menuContainerRef}>
        <div className="menu_contain">
          <ul className="menu_contain_nav u-gap-small u-hflex-left-center">
            {NAV_LINKS.map((link) => (
              <li className="footer_nav_li" key={link.href}>
                <Link
                  className="footer_nav_text"
                  data-hover-highlight="link"
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.href)}
                >
                  <div
                    className="footer_nav_span type-h3"
                    data-hover-heading=""
                  >
                    {link.label}
                  </div>
                  <div
                    className="footer_nav_span type-h3 is-arrow"
                    data-footer-arrow=""
                  >
                    →
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <button
          aria-label="Close menu"
          className="menu_overlay_close"
          onClick={() => setIsMenuOpen(false)}
          type="button"
        />
      </div>
    </>
  );
};
