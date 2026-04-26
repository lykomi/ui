/**
 * Default home page. The Foundry UI shell renders the chat surface, sidebar
 * navigation, and theme controls automatically — your customer pages are
 * for additional routes (e.g. /workspace, /jobs).
 *
 * Replace this with whatever your app's `/` route should be.
 */
export function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Welcome to your Foundry UI app</h1>
      <p className="max-w-md text-muted-foreground">
        The chat is ready in the right panel. Add your customer pages in{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">src/pages/</code> and connect a backend
        (FastAPI + agent-framework) to make the agent respond.
      </p>
    </div>
  );
}
