export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Fahrdienst-KI
      </h1>
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
        Projekt angelegt. Die Einrichtung, die Disposition und die Fahrer-App entstehen Phase für
        Phase – siehe docs/09-bauplan.md.
      </p>
    </div>
  );
}
