export function isAskAiPath(pathname: string) {
  if (pathname === "/") {
    return false;
  }

  // Hide Ask AI on catalog slug pages (/catalog/[slug], /components/[slug])
  return (
    !pathname.startsWith("/catalog/") && !pathname.startsWith("/components/")
  );
}
