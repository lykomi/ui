# Foundry 3D model preview

`@iloveagents/foundry-web-model3d` is an optional MIT package for self-contained
GLB files and agent-controlled part inspection. It versions independently of the
core packages. Neither the core shell nor the graph module imports it.

This is a **preview feature**. CAD conversion, geometry interpretation, remote
rendering, AR and backend indexing are outside this package.

## Use in a Foundry app

Install the package when your app needs 3D previews. Add its module to the shell:

```tsx
import { bootstrapShell } from "@iloveagents/foundry-web-shell";
import { ModelView, model3dModule } from "@iloveagents/foundry-web-model3d";

bootstrapShell({
  modules: [model3dModule],
  pages: [
    {
      path: "/model",
      element: <ModelView url="/models/assembly.glb" modelId="assembly-v1" title="Assembly" />,
    },
  ],
});
```

The module registers seven `model3d_*` tools in Foundry's client-tool registry.
AG-UI chat and voice integrations using that registry can inspect, highlight,
point at, focus, rotate, explode and reset the active model. Rendering code and
Three.js load only when `ModelView` mounts. Hosts pass `active={false}` for
hidden tabs and `fetchFn` for authenticated downloads; the package owns neither
authentication nor file storage. Multiple active viewers require a `modelId`.

Add the package to the host's Tailwind scan (adjust relative paths):

```css
@source "../node_modules/@iloveagents/foundry-web-model3d/dist";
```

Controls use the host's existing theme tokens. The left structure tree retains
assembly hierarchy, supports keyboard arrows, Home/End and Enter/Space, and
searches names and metadata while keeping matching parts' ancestors visible.
Tree selection, canvas selection and agent commands refer to the same parts.

## File contract and limits

Self-contained glTF 2.0 binary files (`.glb`) up to 64 MiB are supported. External
buffer/image URLs and compressed Draco/Meshopt/KTX2 assets are rejected. Export
an uncompressed GLB for this preview; large CAD meshes need offline optimization.

Part IDs are `node:N` from the active scene's exported node indices, scoped to
that file revision. Names, parent relationships and object `extras` survive.
Repeated instances remain separately addressable even when they share geometry
and materials. An exporter that flattens a CAD assembly loses that structure;
GLB nodes alone do not establish a verified bill of materials.

Explosion is radial visual separation, not a validated disassembly sequence.
View tools never modify the saved file. The package does not send models to any
third-party service or load a remote SDK.

## Validation

Run `pnpm build`, `pnpm typecheck`, and `pnpm test:unit` in this package. Scene
and tool tests use an original synthetic GLB fixture with repeated occurrences.
The root `pack:check` verifies built JavaScript, declarations and the MIT license
in the packed artifact. Consumers must use a released version from npm.
