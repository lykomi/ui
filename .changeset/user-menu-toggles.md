---
"@iloveagents/foundry-web-ui": minor
---

Apps can add their own settings to the user menu. `useNavStore().setUserMenuToggle({ id, label, checked, onCheckedChange })` registers a checkbox item that `UserMenu` shows in every shell; `removeUserMenuToggle(id)` takes it out again. It is the place for a preference about the whole interface, such as showing hidden items: footer actions are hidden inside a workspace in the workbench.
