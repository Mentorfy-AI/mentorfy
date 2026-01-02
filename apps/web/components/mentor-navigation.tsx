'use client';

import type React from 'react';
import Image from 'next/image';
import {
  Activity,
  BarChart3,
  Brain,
  LayoutGrid,
  Menu,
  MessageSquare,
  Network,
  Settings,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/nextjs';
import { OrgChangeListener } from '@/components/org-change-listener';

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
      name: 'Knowledge',
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

  // Super admin gets additional items
  const superAdminNavItems = [
    ...mentorNavItems,
    {
      name: 'Agent Console',
      href: '/agent-console',
      icon: Terminal,
    },
    {
      name: 'Usage',
      href: '/usage',
      icon: Activity,
    },
  ];

  // Determine which navigation items to show based on role
  let navigationItems = mentorNavItems;

  if (isSuperAdmin) {
    navigationItems = superAdminNavItems;
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
    <div className="h-screen bg-background flex flex-col lg:block overflow-hidden">
      {/* Listen for organization changes and refresh page */}
      <OrgChangeListener />

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-card px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <Image
                  src="/icons/logo-dark.svg"
                  alt="Mentorfy"
                  width={32}
                  height={32}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono">Mentorfy</h1>
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
      <div className="shrink-0 z-40 flex items-center gap-x-6 bg-card px-4 py-4 shadow-sm sm:px-6 lg:hidden">
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
            className="w-72 p-0 flex flex-col"
          >
            <div className="flex items-center space-x-3 shrink-0">
              <div className="my-4 mx-2 w-8 h-8 rounded-lg flex items-center justify-center">
                <Image
                  src="/icons/logo-dark.svg"
                  alt="Mentorfy"
                  width={32}
                  height={32}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono">Mentorfy</h1>
              </div>
            </div>

            <nav className="space-y-2 flex-1 flex flex-col">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`mx-2 flex items-center gap-3 rounded-md p-3 text-sm font-medium transition-colors ${
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

              <div className="border-t pt-4 space-y-3 mt-auto">
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
                    appearance={{
                      elements: {
                        avatarBox: 'w-10 h-10',
                        userButtonPopoverCard: {
                          pointerEvents: 'initial',
                          background: 'white',
                        },
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
      <div className="flex-1 overflow-hidden lg:pl-72 lg:flex lg:flex-col lg:h-screen">
        {/* Desktop Header Bar */}
        <header className="hidden lg:flex items-center justify-between gap-4 px-6 py-4 bg-background shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {navigationItems.find((item) => pathname.startsWith(item.href))?.name || 'Mentorfy'}
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/knowledge-graph">
              <Button
                variant="outline"
                className="h-9"
              >
                <Network className="h-4 w-4 mr-2" />
                View your knowledge
              </Button>
            </Link>
            <Link href="/chat">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                <Sparkles className="h-4 w-4 mr-2" />
                Talk to your AI
              </Button>
            </Link>
          </div>
        </header>

        <main className="h-full lg:flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
