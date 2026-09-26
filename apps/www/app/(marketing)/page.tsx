import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <Link
        className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
        href="/docs"
      >
        Documentation
      </Link>
    </main>
  );
}
