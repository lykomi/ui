import { type FC } from "react";
import { LogOut, User } from "lucide-react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@iloveagents/foundry-web-primitives";
import { authStore } from "@iloveagents/foundry-agent/msal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { Button } from "@iloveagents/foundry-web-primitives";
import { useNavStore } from "../lib/nav-store.ts";

export const UserMenu: FC = () => {
  const { user, signOut } = useStore(
    authStore,
    useShallow((s) => ({ user: s.user, signOut: s.signOut })),
  );
  const toggles = useNavStore((s) => s.userMenuToggles);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 rounded-full px-2"
          aria-label={user ? "User menu" : "Interface menu"}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="size-6 rounded-full" />
          ) : (
            <div
              className={cn(
                "size-6 rounded-full",
                "bg-primary/10 text-primary",
                "flex items-center justify-center",
              )}
            >
              <User className="size-3.5" />
            </div>
          )}
          {user && (
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.name}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {toggles.map((toggle) => (
          <DropdownMenuCheckboxItem
            key={toggle.id}
            checked={toggle.checked}
            onCheckedChange={toggle.onCheckedChange}
          >
            {toggle.label}
          </DropdownMenuCheckboxItem>
        ))}
        {user && (
          <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
