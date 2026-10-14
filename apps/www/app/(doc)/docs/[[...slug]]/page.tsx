import { Button } from "@workspace/ui/components/ui/button";
import { cn } from "@workspace/ui/lib/utils";
import { findNeighbour } from "fumadocs-core/server";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ComponentProps } from "react";

import { baseOptions } from "@/app/layout.config";
import { DocsAuthor } from "@/components/docs/docs-author";
import { DocsHeaderToc } from "@/components/docs/docs-header-toc";
import { DocsPageJsonLd } from "@/components/docs/docs-page-json-ld";
import { DocsPager } from "@/components/docs/docs-pager";
import type { DocsPagerItem } from "@/components/docs/docs-pager";
import { Footer } from "@/components/docs/footer";
import { PageActionButtons } from "@/components/docs/page-actions";
import { source } from "@/lib/docs/source";
import {
  getOgMetadataImages,
  getTwitterMetadataImages,
} from "@/lib/og/og-metadata-images";
import { GITHUB_REPO_URL, getPageAlternates, SITE_URL } from "@/lib/site";
import { getMDXComponents } from "@/mdx-components";

interface GuideLink {
  text: string;
  url: string;
}

const isGuideLink = (link: unknown): link is GuideLink => {
  if (typeof link !== "object" || link === null) {
    return false;
  }
  if (!("url" in link) || !("text" in link)) {
    return false;
  }
  const hasExternal = "external" in link && Boolean(link.external);
  return (
    typeof link.url === "string" &&
    typeof link.text === "string" &&
    !hasExternal
  );
};

const resolveNavItem = (url: string, fallbackName: string): DocsPagerItem => {
  const pageData = source.getPageByHref(url)?.page;
  return {
    description: pageData?.data.description,
    name: pageData?.data.sidebarTitle ?? pageData?.data.title ?? fallbackName,
    url,
  };
};

const DocLink = ({
  className,
  ...props
}: ComponentProps<typeof defaultMdxComponents.a>) => (
  <defaultMdxComponents.a
    {...props}
    className={cn("[overflow-wrap:anywhere] break-words", className)}
  />
);

const DocsPageBody = ({ slug }: { slug?: string[] }) => {
  const page = source.getPage(slug);
  if (!page) {
    return null;
  }

  const MDXContent = page.data.body;

  const tree = source.getPageTree();
  const { previous, next: nextPage } = findNeighbour(tree, page.url);

  const guideItems = (baseOptions.links ?? []).filter(isGuideLink);
  const guideIndex = guideItems.findIndex((it) => it.url === page.url);

  const prevNav: DocsPagerItem | undefined = (() => {
    if (guideIndex > 0 && guideItems.length > 0) {
      const item = guideItems[guideIndex - 1];
      return resolveNavItem(item.url, item.text);
    }

    if (guideIndex === -1 && previous) {
      return resolveNavItem(previous.url, String(previous.name ?? "Previous"));
    }
  })();

  const nextNav: DocsPagerItem | undefined = (() => {
    if (guideIndex !== -1 && guideIndex < guideItems.length - 1) {
      const nextGuideItem = guideItems[guideIndex + 1];
      return resolveNavItem(nextGuideItem.url, nextGuideItem.text);
    }

    if (guideIndex === -1 && nextPage) {
      return resolveNavItem(nextPage.url, String(nextPage.name ?? "Next"));
    }
  })();

  return (
    <DocsPage
      article={{
        className: "min-w-0 max-w-full [&>[role=none].flex-1]:hidden",
      }}
      footer={{
        component: (
          <div className="flex w-full flex-col gap-6">
            <DocsPager next={nextNav} previous={prevNav} />
            <Footer
              lastUpdate={
                page.data.lastModified
                  ? new Date(page.data.lastModified)
                  : undefined
              }
            />
          </div>
        ),
      }}
      full={page.data.full}
      tableOfContent={{ style: "clerk" }}
      tableOfContentPopover={{
        component: <DocsHeaderToc />,
      }}
      toc={page.data.toc}
    >
      <DocsPageJsonLd page={page} />
      <div className="flex w-full flex-row items-start justify-between gap-2">
        <DocsTitle className="font-medium">{page.data.title}</DocsTitle>
        {(prevNav || nextNav) && (
          <div className="flex flex-row items-center gap-1.5 pt-0.5">
            <Link
              aria-disabled={!prevNav}
              aria-label={
                prevNav ? `Go to ${prevNav.name}` : "No previous page"
              }
              className={prevNav ? undefined : "pointer-events-none opacity-50"}
              href={prevNav?.url ?? page.url}
            >
              <Button size="icon-sm" variant="accent">
                <ArrowLeft />
              </Button>
            </Link>
            <Link
              aria-disabled={!nextNav}
              aria-label={nextNav ? `Go to ${nextNav.name}` : "No next page"}
              className={nextNav ? undefined : "pointer-events-none opacity-50"}
              href={nextNav?.url ?? page.url}
            >
              <Button size="icon-sm" variant="accent">
                <ArrowRight />
              </Button>
            </Link>
          </div>
        )}
      </div>
      <DocsDescription className="mb-1 font-normal">
        {page.data.description}
      </DocsDescription>
      {page.data.author && (
        <DocsAuthor name={page.data.author.name} url={page.data.author?.url} />
      )}

      <PageActionButtons
        githubUrl={`${GITHUB_REPO_URL}/blob/main/apps/www/content/docs/${page.path}`}
        key={page.url}
        markdownUrl={`${page.url}.mdx`}
        url={page.url}
      />

      <DocsBody
        className="max-w-full min-w-0 pt-4 pb-6 break-words"
        id="docs-body"
      >
        <MDXContent
          components={getMDXComponents({
            a: createRelativeLink(source, page, DocLink),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
};

const Page = async (props: { params: Promise<{ slug?: string[] }> }) => {
  const params = await props.params;

  if (!source.getPage(params.slug)) {
    await connection();
    notFound();
  }

  return <DocsPageBody slug={params.slug} />;
};

export default Page;

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async (props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> => {
  const { slug = [] } = await props.params;

  const page = source.getPage(slug);
  if (!page) {
    // Page component 404s; avoid notFound() in cached metadata (see above).
    return {};
  }

  const ogPath = slug;
  const { title } = page.data;

  return {
    alternates: getPageAlternates(page.url),
    authors: page.data?.author
      ? [
          {
            name: page.data.author.name,
            ...(page.data.author?.url && { url: page.data.author.url }),
          },
        ]
      : {
          name: "SoraLabs",
          url: "https://github.com/SoraLabsOSS",
        },
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      images: getOgMetadataImages(ogPath, title),
      locale: "en_US",
      siteName: "Motion Audit",
      title: `${title} | Motion Audit`,
      type: "website",
      url: `${SITE_URL}${page.url}`,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description: page.data.description,
      images: getTwitterMetadataImages(ogPath),
      title: `${title} | Motion Audit`,
    },
  };
};
