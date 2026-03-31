import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex w-full max-w-3xl flex-col items-center py-16 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
            Welcome to AeroFlux
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Your comprehensive platform for travel agencies and agents. Sign in or
            create an account to get started.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/login"
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-zinc-900 px-5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-200 px-5 font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Create Account
          </Link>
        </div>
      </main>
    </div>
  );
}
