export interface DocRedirect {
  destination: string;
  permanent: true;
  source: string;
}

export function buildDocRedirects(_appRoot: string): DocRedirect[] {
  return [];
}
