export function ReaderPlaceholder({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="h-full grid place-items-center p-6">
      <div className="soft-card max-w-sm px-5 py-4 text-center">
        <p className="text-sm font-semibold text-neutral-100">{title}</p>
        <p className="text-sm text-neutral-500 mt-1">{detail}</p>
      </div>
    </div>
  );
}
