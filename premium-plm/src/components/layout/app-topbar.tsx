import { useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Menu, Search } from "lucide-react";

import { findNavItem } from "@/app/route-config";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/hooks/useAuth";

export interface AppTopbarProps {
  onOpenNav: () => void;
}

function NavBreadcrumb() {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);

  const isDashboard = pathname === "/";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isDashboard ? (
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link to="/" />}>Premium PLM</BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {!isDashboard ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{current?.label ?? "Not found"}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

const SEARCH_PLACEHOLDER = "Search initiatives, BRDs, people…";

/**
 * Shared search control. Rendered inline on desktop and inside a sheet on
 * mobile so both breakpoints expose the same affordance.
 */
function SearchField({ id }: { id: string }) {
  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />

      <Input
        id={id}
        type="search"
        placeholder={SEARCH_PLACEHOLDER}
        className="h-8 pl-8"
      />
    </div>
  );
}

function GlobalSearch() {
  return (
    <div className="hidden w-72 md:block">
      <SearchField id="global-search-desktop" />
    </div>
  );
}

export function AppTopbar({ onOpenNav }: AppTopbarProps) {
  const { user, role } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchId = useId();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-card px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenNav}
            className="lg:hidden"
          >
            <Menu aria-hidden="true" className="size-4" />
            <span className="sr-only">Open navigation</span>
          </Button>

          <NavBreadcrumb />
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <GlobalSearch />

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search aria-hidden="true" className="size-4" />
          </Button>

          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
            <Bell aria-hidden="true" className="size-4" />
          </Button>

          <div className="hidden items-center gap-2 sm:flex">
            <UserAvatar name={user?.userName ?? "User"} size="sm" />

            <div className="min-w-0">
              <p className="max-w-[10rem] truncate text-xs font-semibold">
                {user?.userName ?? "Not signed in"}
              </p>
              <p className="truncate text-[0.6875rem] text-muted-foreground">
                {role}
              </p>
            </div>
          </div>
        </div>
      </header>

      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="top" className="gap-3 p-4">
          <SheetTitle className="sr-only">Search</SheetTitle>
          <SheetDescription className="sr-only">
            Search initiatives, BRDs and people across the workspace.
          </SheetDescription>

          <Label htmlFor={searchId} className="text-xs font-medium">
            Search
          </Label>

          <SearchField id={searchId} />

          <p className="text-xs text-muted-foreground">
            Search is not wired to a backend yet.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
