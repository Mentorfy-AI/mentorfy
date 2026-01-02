'use client';

import type React from 'react';
import {
  Users,
  MessageSquare,
  Brain,
  Zap,
  LayoutGrid,
  User,
  Sparkles,
  Terminal,
  Network,
} from 'lucide-react';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { BarChart3, Bell, Settings, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/nextjs';

interface MentorNavigationProps {
  children: React.ReactNode;
}

export function MentorNavigation({ children }: MentorNavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { orgRole } = useAuth();
  const { user } = useUser();

  // Check if user is super admin
  useEffect(() => {
    fetch('/api/auth/is-super-admin')
      .then((res) => res.json())
      .then((data) => setIsSuperAdmin(data.isSuperAdmin))
      .catch(() => setIsSuperAdmin(false));
  }, []);

  // Navigation items for mentors (admin/team_member)
  const mentorNavItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
    },
    {
      name: 'Users',
      href: '/users',
      icon: Users,
    },
    {
      name: 'Conversations',
      href: '/conversations',
      icon: MessageSquare,
    },
    {
      name: 'Mind',
      href: '/knowledge',
      icon: Brain,
    },
    {
      name: 'Your Agents',
      href: '/agents',
      icon: Zap,
    },
    {
      name: 'Integrations',
      href: '/integrations',
      icon: LayoutGrid,
    },
  ];

  // Navigation items for students
  const studentNavItems = [
    {
      name: 'Dashboard',
      href: '/student/dashboard',
      icon: BarChart3,
    },
    {
      name: 'Chat',
      href: '/student/chat',
      icon: MessageSquare,
    },
    {
      name: 'Resources',
      href: '/student/resources',
      icon: Brain,
    },
  ];

  // Super admin gets additional items
  const superAdminNavItems = [
    ...mentorNavItems,
    {
      name: 'Agent Console',
      href: '/agent-console',
      icon: Terminal,
    },
  ];

  // Determine which navigation items to show based on role
  let navigationItems = mentorNavItems;

  if (isSuperAdmin) {
    navigationItems = superAdminNavItems;
  } else if (orgRole === 'org:student') {
    navigationItems = studentNavItems;
  } else if (orgRole === 'org:admin' || orgRole === 'org:team_member') {
    navigationItems = mentorNavItems;
  }

  // Get user display name (first + last name, fallback to email)
  const getDisplayName = () => {
    if (!user) return 'Account';
    const firstName = user.firstName?.trim();
    const lastName = user.lastName?.trim();
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    return user.primaryEmailAddress?.emailAddress || 'Account';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-card px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  M
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Mentorfy</h1>
                <p className="text-xs text-muted-foreground">
                  AI Mentorship Platform
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul
              role="list"
              className="flex flex-1 flex-col gap-y-7"
            >
              <li>
                <ul
                  role="list"
                  className="-mx-2 space-y-1"
                >
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>

              <li className="mt-auto space-y-4">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>

                {/* Organization Switcher */}
                <OrganizationSwitcher
                  hidePersonal={true}
                  appearance={{
                    elements: {
                      organizationSwitcherPopoverCard:
                        'bg-popover/100 backdrop-blur-none',
                    },
                  }}
                />

                {/* User Button */}
                <div className="flex items-center gap-3 p-2">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: 'w-10 h-10',
                        userButtonPopoverCard:
                          'bg-popover/100 backdrop-blur-none',
                      },
                    }}
                  >
                    <UserButton.MenuItems>
                      <UserButton.Link
                        label="Organization Settings"
                        labelIcon={<Settings className="h-4 w-4" />}
                        href="/settings"
                      />
                    </UserButton.MenuItems>
                  </UserButton>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getDisplayName()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Manage profile
                    </p>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-card px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <Sheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        >
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-m-2.5"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  M
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Mentorfy</h1>
                <p className="text-xs text-muted-foreground">
                  AI Mentorship Platform
                </p>
              </div>
            </div>

            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-md p-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}

              <div className="border-t pt-4 mt-4 space-y-3">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>

                {/* Organization Switcher */}
                <OrganizationSwitcher
                  hidePersonal={true}
                  appearance={{
                    elements: {
                      organizationSwitcherPopoverCard:
                        'bg-popover/100 backdrop-blur-none',
                    },
                  }}
                />

                {/* User Button */}
                <div className="flex items-center gap-3 p-3 border rounded-md border-border">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: 'w-10 h-10',
                        userButtonPopoverCard:
                          'bg-popover/100 backdrop-blur-none',
                      },
                    }}
                  >
                    <UserButton.MenuItems>
                      <UserButton.Link
                        label="Organization Settings"
                        labelIcon={<Settings className="h-4 w-4" />}
                        href="/settings"
                      />
                    </UserButton.MenuItems>
                  </UserButton>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getDisplayName()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Manage profile
                    </p>
                  </div>
                </div>
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex-1 text-sm font-semibold leading-6">
          {navigationItems.find((item) => item.href === pathname)?.name ||
            'Mentorfy'}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/knowledge-graph">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
            >
              <Network className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/chat">
            <Button className="relative bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 h-9 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 border-0 rounded-lg before:absolute before:inset-0 before:rounded-lg before:bg-blue-500/30 before:blur-md before:-z-10 before:animate-pulse">
              <Sparkles className="h-4 w-4 mr-2" />
              Talk to AI
            </Button>
          </Link>

          <ThemeToggle />
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
                userButtonPopoverCard: 'bg-popover/100 backdrop-blur-none',
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link
                label="Organization Settings"
                labelIcon={<Settings className="h-4 w-4" />}
                href="/settings"
              />
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-72">
        <div className="hidden lg:flex fixed top-6 right-6 z-30 gap-4">
          <Link href="/knowledge-graph">
            <Button
              variant="outline"
              className="relative px-6 py-3 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-lg"
            >
              <Network className="h-5 w-5 mr-2" />
              View your knowledge
            </Button>
          </Link>
          <Link href="/chat">
            <Button className="relative bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 border-0 rounded-lg before:absolute before:inset-0 before:rounded-lg before:bg-blue-500/40 before:blur-lg before:-z-10 before:animate-pulse">
              <Sparkles className="h-5 w-5 mr-2" />
              Talk to your AI
            </Button>
          </Link>
        </div>

        <main className="min-h-screen lg:pt-20">{children}</main>
      </div>
    </div>
  );
}
