export function WorkbenchStyles() {
  return (
    <style>{`
        .workbench-preview [data-panel-resize] {
          width: 12px;
          right: 0 !important;
          z-index: 40;
          touch-action: none;
          background: transparent;
          outline: none;
        }
        .workbench-preview [data-panel-resize] > div { display: none; }
        .workbench-preview [data-panel-resize]::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 3px;
          width: 6px;
          height: 56px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: var(--border);
          box-shadow: 0 1px 2px #00000014;
          opacity: 0;
          transition: opacity 120ms ease;
        }
        .workbench-preview [data-panel-resize]:hover::after,
        .workbench-preview [data-panel-resize]:focus-visible::after,
        .workbench-preview [data-panel-resize]:active::after { opacity: 1; }
        .workbench-preview select:not([multiple]):not([size]),
        .workbench-preview select[size="1"]:not([multiple]) {
          appearance: none;
          padding-right: 36px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px 16px;
        }
        .preview-account-compact button > span:not(.sr-only) { display: none; }
        .workbench-preview #preview-assistant textarea::placeholder {
          font-size: 14px;
          font-weight: 400;
          color: color-mix(in srgb, var(--muted-foreground) 65%, var(--background));
          opacity: 1;
        }
        .workbench-preview #preview-assistant button[aria-label="Add to this message"] {
          width: 32px;
          height: 32px;
          margin-left: -8px;
          padding: 0;
        }
        .workbench-preview #preview-assistant button[aria-label="Add to this message"] svg {
          width: 16px;
          height: 16px;
        }

        .workbench-preview #preview-assistant button[aria-label="Send message"],
        .workbench-preview #preview-assistant button[aria-label="Stop generating"] {
          width: 32px;
          height: 32px;
          min-width: 32px;
          padding: 0;
        }

        .workbench-preview .preview-mobile-navigation { display: none; }
        @media (max-width: 767px) {
          .workbench-preview .preview-mobile-navigation { display: inline-flex; }
        }
        .workbench-preview [data-chat-collapsed="true"] [data-chat-header] button,
        .workbench-preview [data-chat-rail] button {
          width: 36px;
          max-width: 36px;
          flex-shrink: 0;
          padding: 8px;
        }

        .workbench-preview [data-chat-composer-divider] { display: none; }
        .workbench-preview [data-global-chat] section[aria-label="Chat history"] {
          width: 100%; max-width: 48rem; margin-left: auto; margin-right: auto;
          box-sizing: border-box;
        }
        .workbench-preview [data-global-chat] form { border-radius: 16px; }
        /* One motion treatment for navigation and both working panes. */
        .workbench-preview [data-sidebar-surface],
        .workbench-preview [data-panel-motion] {
          transition: width 200ms ease-in-out, min-width 200ms ease-in-out;
        }
        .workbench-preview [data-resizing] [data-panel-motion] { transition: none; }
        @media (prefers-reduced-motion: reduce) {
          .workbench-preview [data-sidebar-surface],
          .workbench-preview [data-panel-motion] { transition: none; }
        }
        .workbench-preview [data-sidebar-collapsed] button,
        .workbench-preview [data-sidebar-collapsed] a {
          width: 36px; height: 36px; min-width: 36px; padding: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          align-self: center; border-radius: 8px;
        }
        .workbench-preview [data-sidebar-collapsed] svg {
          width: 18px; height: 18px; stroke-width: 2;
        }
        .workbench-preview {
          --workbench-header-height: 60px;
          --workbench-rail-inset: 8px;
          --workbench-rail-gap: 4px;
          background: var(--sidebar);
          --workbench-outline: var(--border);
          padding: 8px 8px 8px 0;
        }
        .workbench-preview [data-workbench-surface] {
          position: relative;
          border-radius: 12px;
          background: var(--background);
        }
        .workbench-preview [data-workbench-surface]::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border: 1px solid var(--workbench-outline);

          border-radius: inherit;
          z-index: 30;
        }
        .workbench-preview #preview-assistant::after {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          z-index: 20;
          pointer-events: none;
          background: color-mix(in srgb, var(--border) 55%, transparent);
        }

        @container hdr (max-width: 700px) {
          .workbench-preview [data-entity-header-identity] {
            flex-basis: 100%;
          }
          .workbench-preview [data-entity-header-identity] h1 {
            min-width: 0;
          }
        }
        /* Collapsed navigation and chat share the same header and first row. */
        .workbench-preview [data-navigation-rail] {
          padding-block: 0;
          gap: 0;
        }
        .workbench-preview [data-navigation-rail-items],
        .workbench-preview [data-chat-shortcuts] {
          margin-top: 0;
          padding-top: var(--workbench-rail-inset);
          gap: var(--workbench-rail-gap);
        }
        .workbench-preview [data-navigation-header],
        .workbench-preview [data-chat-header] {
          height: var(--workbench-header-height);
          min-height: var(--workbench-header-height);
          flex-shrink: 0;
          box-sizing: border-box;
          padding-top: 0;
          padding-bottom: 0;
          align-items: center;
        }
        .workbench-preview [data-navigation-header] button,
        .workbench-preview [data-chat-header] button {
          height: 36px;
          min-width: 36px;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }
        .workbench-preview [data-navigation-header] button,
        .workbench-preview [data-chat-header] button,
        .workbench-preview [data-chat-rail] button {
          color: var(--muted-foreground);
          background-color: transparent;
        }
        .workbench-preview [data-navigation-header] button:hover,
        .workbench-preview [data-chat-header] button:hover,
        .workbench-preview [data-chat-rail] button:hover {
          color: var(--foreground);
          background-color: var(--muted);
        }
        .workbench-preview [data-navigation-header] button svg,
        .workbench-preview [data-chat-header] button svg,
        .workbench-preview [data-content-collapse] svg,
        .workbench-preview [data-chat-rail] button svg {
          width: 18px;
          height: 18px;
          stroke-width: 2;
          flex-shrink: 0;
        }
        .workbench-preview [data-content-collapse] {
          position: absolute;
          top: calc((var(--workbench-header-height) - 36px) / 2);
          right: var(--workbench-inline-padding, 16px);
          width: 36px;
          height: 36px;
          padding: 8px;
          z-index: 20;
        }
        .workbench-preview [data-working-content]:has(> [data-content-collapse]) [data-preview-entity-header] > [data-entity-header-row] {
          padding-right: var(--workbench-header-actions-inset, calc(var(--workbench-inline-padding, 16px) + 44px));
        }
        .workbench-preview [data-working-content]:not(:has([data-entity-header-row])):not([data-item-panel-open]) {
          padding-top: var(--workbench-header-height);
        }
        @media print {
          .workbench-preview [data-content-collapse] { display: none; }
        }
        .workbench-preview [data-conversation-row] {
          color: var(--sidebar-foreground);
          font-size: 14px;
          line-height: 20px;
        }
        /* Preview-only hierarchy: workspace title first, quiet section labels,
           and one consistent rhythm for conversation and content rows. */
        .workbench-preview [data-nav-group-header],
        .workbench-preview [data-conversation-section-label] {
          min-height: 32px;
          gap: 0;
          background: transparent;
          font-size: 12px;
          font-weight: 500;
          line-height: 16px;
          letter-spacing: normal;
          text-transform: none;
          color: var(--muted-foreground);
        }
        .workbench-preview [data-nav-group-header] span:not([data-nav-status-dot]) {
          font-size: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
          text-transform: none;
          color: inherit;
        }
        .workbench-preview [data-nav-group-header] > span[aria-hidden="true"] {
          display: none;
        }
        .workbench-preview [data-nav-group-label] > div:has(> [data-nav-group-header]) {
          padding-top: 18px;
          padding-bottom: 2px;
        }
        .workbench-preview [data-conversation-row],
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth] {
          min-height: 32px;
          padding-top: 4px;
          padding-bottom: 4px;
          gap: 8px;
          border-radius: 8px;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth="0"] {
          padding-left: 12px;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth="0"] > [data-nav-twisty-cell]:not(:has([data-nav-twisty])) {
          display: none;
        }
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth] {
          padding-top: 0;
          padding-bottom: 0;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth="0"]:not([data-nav-branch-status]) {
          padding-left: 0;
        }
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth="0"] > button:not([data-nav-twisty]),
        .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-branch-status][data-nav-depth="0"] {
          padding-left: 12px;
          min-height: 32px;
          gap: 8px;
        }
        .workbench-preview [data-sidebar-surface] nav > [data-nav-group-label]:first-child > div:has(> [data-nav-group-header]) {
          padding-top: 0;
        }
        [data-workspace-navigation] [data-nav-group-label="All spaces"] [data-nav-depth="0"] > button {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: normal;
          line-height: 20px;
        }
        [data-workspace-navigation] [data-nav-group-label="Recent chats"] > :first-child {
          padding-top: 10px;
        }
        [data-workspace-navigation] [data-nav-group-label="Content"] {
          margin-top: 0;
        }
        .workbench-preview [data-nav-group-label="All spaces"] > div:has(> [data-nav-group-header]) {
          padding-top: 8px;
        }
        .workbench-preview [data-nav-group-label="All spaces"] [data-nav-group-header] {
          height: 32px;
          min-height: 32px;
          padding-top: 0;
          padding-bottom: 0;
        }
        .workbench-preview [data-nav-group-label="All spaces"] [data-nav-group-items] {
          animation: none;
        }
        /* The first utility row shares the heading line in both scopes. */
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) nav:has(> [data-nav-group-label="Activity"]:first-child) {
          padding-top: 8px;
        }
        .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Activity"] [data-nav-depth="0"] {
          padding-left: 12px;
        }
        .workbench-preview [data-nav-group-label="Activity"] [data-nav-twisty-cell]:not(:has([data-nav-twisty])) {
          display: none;
        }
        .workbench-preview[data-workspace-navigation]:not(:has([data-page-title-row])) [data-chat-empty-state] {
          padding-top: 28px;
        }
        .workbench-preview[data-workspace-navigation] [data-preview-entity-header] > [data-entity-header-row] {
          padding-top: 24px;
          min-height: 76px;
        }
        .workbench-preview[data-workspace-navigation] [data-entity-header-identity]:not(:has([aria-label="Page location"])) {
          padding-top: 18px;
        }

        [data-workspace-navigation] [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Content"] button[data-nav-depth],
        [data-workspace-navigation] [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Content"] div[data-nav-depth] > button:not([data-nav-twisty]),
        [data-workspace-navigation] [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Content"] [data-nav-branch-status] {
          padding-left: calc(32px + var(--nav-depth, 0) * 16px);
        }
        [data-workspace-navigation] [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-group-label="Content"] [data-nav-depth] > [data-nav-twisty-cell] {
          left: calc(12px + var(--nav-depth, 0) * 16px);
        }

        @media (pointer: fine) {
          .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth]:not([data-nav-branch-status]) {
            height: 32px;
            min-height: 32px;
            padding-top: 0;
            padding-bottom: 0;
          }
          .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth] > button:not([data-nav-twisty]) {
            height: 30px;
            min-height: 30px;
            padding-top: 0;
            padding-bottom: 0;
          }
          .workbench-preview:not([data-workspace-navigation]) [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth="0"] > button:not([data-nav-twisty]) {
            min-height: 30px;
          }
        }

        @media (pointer: coarse) {
          .workbench-preview [data-conversation-row],
          .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) [data-nav-depth] {
            min-height: 44px;
          }
          .workbench-preview [data-sidebar-surface]:not([data-sidebar-collapsed]) div[data-nav-depth] > button:not([data-nav-twisty]) {
            min-height: 44px;
          }
        }
      `}</style>
  );
}
