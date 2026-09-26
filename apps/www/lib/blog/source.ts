export const blog = {
  getPage: () => {},
  getPages: () => [] as any[],
  pageTree: { children: [], name: "Blog" },
};

// biome-ignore lint/suspicious/noExplicitAny: stubbed after blog removal
export type BlogPage = any;
