/** Скелет загрузки страницы поиска. */
export default function SearchLoading() {
  return (
    <div className="container space-y-6 py-6">
      <div className="mx-auto max-w-xl space-y-2">
        <div className="h-8 w-44 animate-pulse rounded bg-secondary" />
        <div className="h-10 w-full animate-pulse rounded-full bg-secondary" />
      </div>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="space-y-2 p-2">
            <div className="aspect-cover animate-pulse rounded-md bg-secondary" />
            <div className="h-3 w-full animate-pulse rounded bg-secondary" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
