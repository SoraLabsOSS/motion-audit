"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  fetchStaticSearchIndex,
  resolveBookmarkPages,
} from "@/lib/bookmarks/resolve-pages";
import { useBookmarks } from "@/lib/bookmarks/use-bookmarks";

const STATIC_INDEX_STALE_TIME_MS = 10 * 60 * 1000;
const STATIC_INDEX_GC_TIME_MS = 30 * 60 * 1000;

export function useBookmarkPages() {
  const {
    bookmarks,
    isAuthenticated,
    isBookmarksLoading,
    isToggling,
    error,
    refetch,
    removingUrl,
    sessionPending,
    toggleBookmark,
  } = useBookmarks();

  const staticQuery = useQuery({
    enabled: isAuthenticated && bookmarks.length > 0,
    gcTime: STATIC_INDEX_GC_TIME_MS,
    queryFn: fetchStaticSearchIndex,
    queryKey: ["static-search-index"],
    refetchOnWindowFocus: false,
    staleTime: STATIC_INDEX_STALE_TIME_MS,
  });

  const pages = useMemo(
    () => resolveBookmarkPages(bookmarks, staticQuery.data),
    [bookmarks, staticQuery.data]
  );

  const isResolvingPages =
    isAuthenticated &&
    bookmarks.length > 0 &&
    staticQuery.isPending &&
    !staticQuery.data;

  const loading =
    sessionPending ||
    (isAuthenticated && isBookmarksLoading && bookmarks.length === 0) ||
    isResolvingPages;

  return {
    error,
    isAuthenticated,
    isRemoving: isToggling,
    loading,
    pages,
    refetch,
    removeBookmark: (url: string) => toggleBookmark(url, true),
    removingUrl,
    sessionPending,
  };
}
