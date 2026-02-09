export default function LoadingFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      {/* Fallback simples: spinner + texto centralizado */}
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/80 px-4 py-3 shadow-sm">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  )
}
