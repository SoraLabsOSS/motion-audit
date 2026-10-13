export interface DocRedirect {
  destination: string;
  permanent: true;
  source: string;
}

export const buildDocRedirects = (_appRoot: string): DocRedirect[] => [];
