import { useEffect } from "react";
import { registerModelClientTools } from "./model-tools.ts";
function useModelTools() {
  useEffect(() => {
    registerModelClientTools();
  }, []);
}
/** Optional ChatModule: add to bootstrapShell({ modules }) to expose model tools. */
export const model3dModule = { name: "model3d", useInit: useModelTools };
