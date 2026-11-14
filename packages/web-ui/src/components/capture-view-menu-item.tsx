import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAui } from "@assistant-ui/react";
import { Button } from "@lykomi/web-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "../ui/dialog.tsx";
import { captureView } from "../lib/capture-view.ts";
import { useChatRuns } from "../lib/chat-runs-store.ts";
import { guidanceViewKey } from "../lib/guidance-targets.ts";

/** Keep capture and preview alive when the menu closes for the system picker. */
export function CaptureViewAction({
  children,
}: {
  children: (capture: () => void, pending: boolean) => ReactNode;
}) {
  const aui = useAui();
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{
    file: File;
    url: string;
    view: string;
    thread: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const capture = async () => {
    const view = guidanceViewKey();
    const thread = useChatRuns.getState().foregroundId;
    setPending(true);
    setError(null);
    try {
      const file = await captureView();
      if (!mounted.current) return;
      if (view !== guidanceViewKey() || thread !== useChatRuns.getState().foregroundId)
        throw new Error("The view or conversation changed. Capture the current view again.");
      setPreview({ file, url: URL.createObjectURL(file), view, thread });
    } catch (reason) {
      if (!mounted.current || (reason instanceof DOMException && reason.name === "NotAllowedError"))
        return;
      setError(reason instanceof Error ? reason.message : "Could not capture the view.");
    } finally {
      if (mounted.current) setPending(false);
    }
  };
  const attach = async () => {
    if (!preview) return;
    if (
      preview.view !== guidanceViewKey() ||
      preview.thread !== useChatRuns.getState().foregroundId
    ) {
      setPreview(null);
      setError("The view or conversation changed. Capture the current view again.");
      return;
    }
    try {
      await aui.composer.addAttachment(preview.file);
      setPreview(null);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "Could not attach the image.");
    }
  };
  return (
    <>
      {children(() => void capture(), pending)}
      <Dialog
        open={!!preview || !!error}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
            setError(null);
          }
        }}
      >
        <DialogContent data-guidance-ignore>
          <DialogTitle>{error ? "Screen capture" : "Attach this view?"}</DialogTitle>
          <DialogDescription>
            {error ??
              "Review the image before adding it. It will be sent as a normal chat attachment with your next message."}
          </DialogDescription>
          {preview && (
            <img
              src={preview.url}
              alt="Captured view"
              className="max-h-80 w-full rounded-lg object-contain"
            />
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
            {preview && <Button onClick={() => void attach()}>Add to message</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
