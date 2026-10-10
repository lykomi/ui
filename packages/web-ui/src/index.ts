export { PinToggle } from "./components/pin-toggle.tsx";
// --- Components ---
export { Sidebar } from "./components/sidebar.tsx";
export { ToolPanel } from "./components/tool-panel.tsx";
export { ToolPanelLayout } from "./components/tool-panel-layout.tsx";
export { MarkdownText, markdownComponents } from "./components/markdown-text.tsx";
export { MermaidDiagram } from "./components/mermaid-diagram.tsx";
export { ClientToolExecutor } from "./components/client-tool-executor.tsx";
export {
  AGUIRuntimeProvider,
  useAGUIAdapter,
  useIsForegroundChat,
} from "./components/ag-ui-runtime-provider.tsx";
export { useCurrentThreadId } from "./components/ag-ui-adapter-context.ts";
export type {
  AGUIChatConversationFactoryArgs,
  AGUIHistoryAdapterFactory,
} from "./components/ag-ui-runtime-provider.tsx";
export {
  ChatContent,
  DEFAULT_STARTER_SUGGESTIONS,
  DEFAULT_COMPOSER_PLACEHOLDER,
} from "./components/assistant-chat.tsx";
export { ComposerAddMenu, type ComposerAddMenuProps } from "./components/composer-add-menu.tsx";
export type { ChatContentProps } from "./components/assistant-chat.tsx";
export { ChatBubble } from "./components/chat-bubble.tsx";
export {
  registerChatSlots,
  useChatSlotsStore,
  ChatComposerBannerSlot,
  ChatHomeStartersSlot,
  ChatLauncherBadgeSlot,
  ChatComposerActionsSlot,
  useComposerActionsOwnSend,
  useChatThreadSurface,
} from "./components/chat-slots.tsx";
export { ChatHeader } from "./components/chat-header.tsx";
export {
  ComposerAttachment,
  UserMessageAttachment,
  userAttachmentComponents,
  composerAttachmentComponents,
} from "./components/chat-attachments.tsx";
export { ShowDocumentToolUI } from "./components/show-document-tool-ui.tsx";
export { ToolCallCard } from "./components/tool-call-card.tsx";
export type { ToolCallStatus, ToolCallCardProps } from "./components/tool-call-card.tsx";
export { ToolFallback } from "./components/tool-fallback.tsx";
export { ConfirmationCard } from "./components/confirmation-card.tsx";
export { TooltipIconButton } from "./components/tooltip-icon-button.tsx";
export { SentContextBadges } from "./components/context-badges.tsx";
export { usePagePin } from "./components/context-bar.tsx";
export { SelectionPopover } from "./components/selection-popover.tsx";
export { GlobalSelectionPopover } from "./components/global-selection-popover.tsx";
export { LoadingIndicator } from "./components/loading-indicator.tsx";
export { ThemeToggle } from "./components/theme-toggle.tsx";
export { AppBrand } from "./components/app-brand.tsx";
export { CollectionToolbar } from "./components/collection-toolbar.tsx";
export { CollectionSearchInput } from "./components/collection-search-input.tsx";
export {
  CollectionFilterBar,
  type CollectionFilterDefinition,
  type CollectionFilterOption,
  type CollectionFilterValue,
} from "./components/collection-filter-bar.tsx";
export {
  CollectionSortMenu,
  type CollectionSortOption,
} from "./components/collection-sort-menu.tsx";
export {
  CollectionViewToggle,
  type CollectionViewMode,
} from "./components/collection-view-toggle.tsx";
export { CollectionEmptyState } from "./components/collection-empty-state.tsx";
export { CollectionSkeleton } from "./components/collection-skeleton.tsx";
export { InfiniteScrollSentinel } from "./components/infinite-scroll-sentinel.tsx";
export { CollectionSurface } from "./components/collection-surface.tsx";
export { DataTable, type DataTableProps } from "./components/data-table/data-table.tsx";
export {
  DataTableFrame,
  useDataTableFrame,
  type DataTableFrameProps,
  type DataTableFrameContextValue,
} from "./components/data-table/data-table-frame.tsx";
export {
  DataTableSelectionBar,
  type DataTableSelectionBarProps,
} from "./components/data-table/data-table-selection-bar.tsx";
export {
  DataTableToolbar,
  visibleFacets,
  type DataTableFacet,
  type DataTableToolbarLayout,
  type DataTableToolbarProps,
} from "./components/data-table/data-table-toolbar.tsx";
export {
  DataTableFacetedFilter,
  type DataTableFacetedFilterProps,
} from "./components/data-table/data-table-faceted-filter.tsx";
export {
  DataTableViewOptions,
  type DataTableViewOptionsProps,
} from "./components/data-table/data-table-view-options.tsx";
export {
  DataTableColumnHeader,
  type DataTableColumnHeaderProps,
} from "./components/data-table/data-table-column-header.tsx";
export {
  DataTablePagination,
  type DataTablePaginationProps,
} from "./components/data-table/data-table-pagination.tsx";
export {
  DataTableRowActions,
  type DataTableRowAction,
  type DataTableRowActionsProps,
} from "./components/data-table/data-table-row-actions.tsx";
export { selectionColumn, SELECTION_COLUMN_ID } from "./components/data-table/selection-column.tsx";
export {
  useDataTable,
  defaultHiddenColumns,
  type UseDataTableOptions,
} from "./components/data-table/use-data-table.ts";
export {
  usePinnedOffsets,
  type PinnedOffsets,
} from "./components/data-table/use-pinned-offsets.ts";
export { useElementWidth } from "./components/data-table/use-element-width.ts";
export {
  DEFAULT_PAGE_SIZE,
  EMPTY_DATA_TABLE_STATE,
  isDataTableUrlKey,
  mergeDataTableUrlState,
  parseDataTableState,
  serializeDataTableState,
  type DataTableState,
  type DataTableUrlOptions,
} from "./components/data-table/state.ts";
export {
  ageBucket,
  ageBuckets,
  dueState,
  parseDateish,
  relativeAge,
  type AgeBucket,
  type DateBucketOptions,
  type DueState,
  type DueStateOptions,
} from "./components/data-table/date-buckets.ts";
export {
  DATA_TABLE_MIN_WIDTH,
  FACET_EMPTY,
  cellText,
  columnFacetKeys,
  columnLabel,
  facetCounts,
  facetFilterFn,
  facetKeys,
  facetOptions,
  normalizeFacetValue,
  rowSearchText,
  tokenSearchFilterFn,
  type DataTableBreakpoint,
  type DataTableFacetCount,
  type DataTableFacetOption,
} from "./components/data-table/facets.ts";
export {
  createColumnHelper,
  flexRender,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
export {
  ThemeRuntimeProvider,
  ThemeScope,
  ThemeDocumentMetadata,
  useThemeRuntime,
} from "./components/theme-runtime-provider.tsx";
export { JsonViewer } from "./components/json-viewer.tsx";
export { UserMenu } from "./components/user-menu.tsx";
export { FormDialog } from "./components/form-dialog.tsx";
export { ConfirmDialog } from "./components/confirm-dialog.tsx";
export { NameDialog } from "./components/name-dialog.tsx";
export { SurfaceCard, surfaceCardVariants } from "./components/surface-card.tsx";

// --- Composite UI primitives (theme-runtime-coupled — stay here for now) ---
// Button, Checkbox, Input, Textarea, Field, FieldSet have moved to
// @iloveagents/foundry-web-primitives (#94). The primitives below have a runtime
// coupling to ThemeScope (theme-runtime-provider.tsx) — they need a
// theme-system refactor before they can move to the leaf primitives
// package. Tracked for a follow-up under #95/#96.
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./ui/tooltip.tsx";
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible.tsx";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./ui/dropdown-menu.tsx";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog.tsx";
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent } from "./ui/popover.tsx";
export { Select, selectClassName } from "./ui/select.tsx";

// --- Stores ---
export { useAppStore } from "./lib/app-store.ts";
export { useNavStore, type NavFooterAction, type UserMenuToggle } from "./lib/nav-store.ts";
export { useToolPanelStore } from "./lib/tool-panel-store.ts";
export type {
  ToolPanelContent,
  PdfHighlightRef,
  PanelRendererEntry,
} from "./lib/tool-panel-store.ts";
export { useSidebarStore, SIDEBAR_WIDTH, RAIL_WIDTH } from "./lib/sidebar-store.ts";
export { useChatBubbleStore } from "./lib/chat-bubble-store.ts";
export { useChatLifecycleStore } from "./lib/chat-lifecycle-store.ts";
export { submitComposerText } from "./lib/composer-submit-store.ts";
export {
  registerSelectionContextResolver,
  resolveSelectionContext,
  type SelectionContextInput,
  type SelectionContextItem,
  type SelectionContextResolver,
  type SelectionContextResult,
} from "./lib/selection-context.ts";
export { useThemeStore } from "./lib/theme-store.ts";
export type { ThemeMode } from "./lib/theme-store.ts";
export {
  THEME_SLOTS,
  mergeThemeDefinitions,
  resolveThemeRuntime,
  getEffectiveThemeMode,
  getThemePreset,
} from "./lib/theme-runtime.ts";
export type {
  ThemeSlot,
  ThemeDefinition,
  ThemeLayer,
  ResolvedThemeRuntime,
  ThemeColorSlots,
  ThemeSidebarSlots,
  ThemeStatusSlots,
  ThemeChartSlots,
  ThemeTypographySlots,
  ThemeRadiusSlots,
  ThemeAppSlots,
  ThemeBranding,
} from "./lib/theme-runtime.ts";
// Stores moved to @iloveagents/foundry-agent (#95): authStore, citationStore,
// streamingStatusStore, clientToolRegistry. Consumers import directly from
// `@iloveagents/foundry-agent` / `@iloveagents/foundry-agent/msal` — no re-exports here per
// the no-shim rule.
export { useDevStore } from "./lib/dev-store.ts";

// --- Nav types ---
export { DEFAULT_NAV_CONFIG, findNavItem } from "./lib/nav-config.ts";
export type {
  NavItem,
  NavItemAction,
  NavItemDnd,
  NavGroup,
  NavGroupCreateAction,
  NavMatch,
  CollapsedRailItem,
  CollapsedRailContext,
} from "./lib/nav-config.ts";

// --- Hooks ---
export { usePageTools } from "./lib/use-page-tools.ts";
export { useNewConversation } from "./lib/use-new-conversation.ts";

// --- Adapters ---
export { AGUIAdapterSDK } from "./lib/ag-ui-adapter.ts";
export { FileAttachmentAdapter, resolveMimeType } from "./lib/attachment-adapter.ts";
export { registerAttachmentAdapter, useAttachmentAdapterStore } from "./lib/attachment-registry.ts";
export {
  registerVoiceAdapter,
  registerSpeechAdapter,
  useVoiceAdapterStore,
} from "./lib/voice-adapter-registry.ts";
export { ReasoningPart, ReasoningMessagePartComponent } from "./components/reasoning-part.tsx";
export { ReasoningEffortPicker } from "./components/reasoning-effort-picker.tsx";
export {
  ConversationMemory,
  useConversationMemory,
  type ConversationMemoryUsage,
} from "./components/conversation-memory.tsx";

// --- Auth ---
// `AuthProvider` is the React MSAL bootstrap (uses `@azure/msal-react`).
// Token store, config, fetch wrapper all live in `@iloveagents/foundry-agent/msal`.
export { AuthProvider } from "./lib/auth-provider.tsx";

// --- Utils ---
// `cn` is sourced from @iloveagents/foundry-web-primitives (the leaf primitives package).
// Re-exporting here would create two canonical sources for the same
// utility — banned per the "no shims" pre-1.0 rule (#90).

export { createUiId } from "./lib/create-ui-id.ts";

export {
  useChatRuns,
  isChatRunActive,
  removeChatRun,
  type ChatRun,
} from "./lib/chat-runs-store.ts";

export { ProcessSteps, processStatusLabels } from "./components/process/process-steps.tsx";
export type {
  ProcessStep,
  ProcessStepStatus,
  ProcessStepsProps,
} from "./components/process/process-steps.tsx";
export { ProcessGuide } from "./components/process/process-guide.tsx";
export type { GuidedProcessStep, ProcessGuideProps } from "./components/process/process-guide.tsx";

export type {
  ProcessAgentContext,
  ProcessContextSnapshot,
} from "./components/process/process-agent-context.ts";
