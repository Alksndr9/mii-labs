interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function LoadingState({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-stone-500">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-green-600" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl bg-red-50 p-6 text-center">
      <p className="font-medium text-red-800">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-full bg-red-700 px-5 py-2 text-sm text-white hover:bg-red-800">
          Повторить
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl">🥗</p>
      <p className="mt-4 text-lg font-medium text-stone-800">{title}</p>
      <div className="mt-2 text-stone-500">{children}</div>
    </div>
  )
}
