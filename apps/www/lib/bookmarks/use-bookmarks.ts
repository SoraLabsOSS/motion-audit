"use client";

import type { BookmarkRecord } from "@/lib/bookmarks/resolve-pages";

const EMPTY_BOOKMARKS: BookmarkRecord[] = [];

export function useBookmarks() {
  return {
    bookmarks: EMPTY_BOOKMARKS,
    error: null,
    isAuthenticated: false,
    isBookmarksLoading: false,
    isLoading: false,
    isToggling: false,
    refetch: () => Promise.resolve(),
    removingUrl: null,
    sessionPending: false,
    toggleBookmark: (_url: string, _isBookmarked: boolean) => {},
    togglingUrl: null,
  };
}
