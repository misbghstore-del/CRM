"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ChevronDown,
  Plus,
  Calendar,
  BarChart3,
  List,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import Logo from "@/components/logo";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    const getUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
        setUserName(user.user_metadata?.full_name || "User");

        // Fetch role from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserRole(profile.role);
        }
      }
    };
    getUser();
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      roles: ["admin", "super_admin", "bdm"],
    },
    {
      name: "New Visit",
      href: "/visits/new",
      icon: Plus,
      roles: ["admin", "super_admin", "bdm"],
    },
    {
      name: "Planner",
      href: "/planner",
      icon: Calendar,
      roles: ["admin", "super_admin", "bdm"],
    },
    {
      name: "KPI Report",
      href: "/kpi",
      icon: BarChart3,
      roles: ["admin", "super_admin", "bdm"],
    },
    {
      name: "All Visits",
      href: "/visits",
      icon: List,
      roles: ["admin", "super_admin"],
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Settings,
      roles: ["admin", "super_admin"],
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <header className="sticky top-0 z-40 w-full glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          {mounted ? (
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-muted-foreground hover:text-primary"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[300px] sm:w-[400px] glass flex flex-col"
              >
                <div className="flex flex-col gap-1 mt-4 mb-6 px-2">
                  <SheetTitle className="text-left text-xl font-heading font-bold text-primary">
                    {userName || "Menu"}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {userRole
                      ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
                      : "User"}
                  </p>
                </div>

                <SheetDescription className="sr-only">
                  Mobile navigation menu
                </SheetDescription>
                <div className="flex-1 flex flex-col gap-2">
                  {filteredNavItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                      >
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          className={cn(
                            "w-full justify-start gap-3 rounded-xl px-4 py-6 font-medium transition-all duration-200",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                              : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.name}
                        </Button>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t pt-4">
                  <Link href="/profile" onClick={() => setIsOpen(false)}>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-xl px-4 py-6 font-medium text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                    >
                      <Settings className="h-5 w-5" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsOpen(false);
                      handleSignOut();
                    }}
                    className="w-full justify-start gap-3 rounded-xl px-4 py-6 font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}

          <div className="flex items-center gap-2 md:hidden">
            <Logo size={32} />
            <span className="text-xl font-heading font-bold text-primary">
              BDM CRM
            </span>
          </div>

          {userName && (
            <div className="hidden text-sm font-medium text-primary md:block">
              {userName}
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-3">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-2 rounded-full px-5 font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30"
                      : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <span className="hidden sm:inline-block">Account</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-card">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {userEmail}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <Link href="/customers">
                  <DropdownMenuItem className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    Customers
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href="/profile">
                  <DropdownMenuItem className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    Profile
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              <span className="hidden sm:inline-block">Account</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
