import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-xl space-y-4 p-8 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.18em] text-ember">
          Not Found
        </p>
        <h1 className="font-heading text-3xl font-semibold">That route does not exist.</h1>
        <p className="text-sm text-ink/70">
          The MVP currently includes only the implemented web routes. Head back to the landing page to
          continue exploring the planned flow.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-full border border-line bg-panel px-5 py-3 text-sm font-medium transition hover:border-ember hover:text-ember"
        >
          Return Home
        </Link>
      </Card>
    </div>
  );
}
