Optional MIT React GLB viewer; preview feature, independently versioned outside the fixed group.

- Keep this package source-neutral: no authentication, backend, workspace, index, customer data or AR SDK.
- Export built ESM and declarations from dist. ModelView lazily imports the rendering surface so module/tool registration does not import Three.js.
- Preserve exported node indices as revision-scoped occurrence IDs, including shared geometry/materials.
- Hidden viewers must never answer client tools. Multiple active viewers require an explicit model ID.
- Metadata is exported text, not inferred geometry or a verified CAD bill of materials.
- Tree selection and agent selection address the same model handle. Keep keyboard navigation and ancestor-aware filtering.
- Run build, typecheck and unit tests; validate the packed artifact outside the workspace before release.
