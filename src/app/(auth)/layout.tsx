import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="mb-8">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          StudIA
        </Link>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
