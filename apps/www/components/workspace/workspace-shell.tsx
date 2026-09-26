"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/ui/base-sidebar";
import { Bookmark, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import type { MouseEvent, ReactNode } from "react";

import { IconLogo } from "@/components/icon-logo";
import { usePageTransition } from "@/components/page-transition/page-transition-provider";

function WorkspaceSidebar() {
  const { setOpenMobile } = useSidebar();
  const closeMobile = useCallback(() => setOpenMobile(false), [setOpenMobile]);
  const pathname = usePathname();
  const handleHomeClick = useWorkspaceHomeClick();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="mx-2 border-sidebar-border border-b px-0 pt-3 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-9 px-2 hover:bg-sidebar-accent"
              render={
                <Link
                  className="flex items-center gap-2"
                  href="/"
                  onClick={handleHomeClick}
                />
              }
              tooltip="Sora UI"
            >
              <IconLogo size="sm" />
              <span className="font-semibold text-sm">Sora UI</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="mx-2 px-0 pt-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="h-8 rounded-lg transition-colors duration-150"
                  isActive={pathname === "/library"}
                  render={<Link href="/library" onClick={closeMobile} />}
                  tooltip="Library"
                >
                  <Bookmark className="size-4" />
                  <span>Library</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mx-2 gap-1 border-sidebar-border border-t px-0 pt-3 pb-2">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 rounded-lg transition-colors duration-150"
              render={<Link href="/docs" onClick={closeMobile} />}
              tooltip="Back to docs"
            >
              <BookOpen className="size-4" />
              <span>Back to docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function WorkspaceShell({
  children,
  defaultOpen,
}: {
  children: ReactNode;
  defaultOpen: boolean;
}) {
  return (
    <SidebarProvider
      className="h-dvh min-h-0 overflow-hidden bg-sidebar"
      defaultOpen={defaultOpen}
    >
      <WorkspaceSidebar />
      <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-sidebar">
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:rounded-tl-[12px] md:border-border/40 md:border-t md:border-l">
          <WorkspaceMobileHeader />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceMobileHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4 md:hidden">
      <SidebarTrigger className="-ms-2 text-muted-foreground [&_svg]:size-5!" />
      <span className="font-medium text-base">My Library</span>
    </header>
  );
}

function useWorkspaceHomeClick() {
  const { setOpenMobile } = useSidebar();
  const { transitionTo } = usePageTransition();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      setOpenMobile(false);
      transitionTo("/", "commercial");
    },
    [setOpenMobile, transitionTo]
  );
}
