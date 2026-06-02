'use client';

import { UserButton } from '@clerk/nextjs';
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';

export function SidebarUserNav() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center px-2">
        <UserButton
          appearance={{
            elements: {
              userButtonBox: 'flex-row-reverse gap-1.5 w-full',
              userButtonOuterIdentifier:
                'text-[13px] text-sidebar-foreground/70',
              userButtonTrigger:
                'h-8 px-2 rounded-lg cursor-pointer hover:bg-sidebar-accent',
              userButtonPopoverCard:
                'rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-[var(--shadow-float)]',
            },
          }}
          showName
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
