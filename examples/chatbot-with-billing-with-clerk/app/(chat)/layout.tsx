import '@/lib/ai/chat-setup';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { AppSidebar } from '@/components/chat/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '@clerk/nextjs/server';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
        <SidebarShell>{children}</SidebarShell>
      </Suspense>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [{ userId }, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar_state')?.value !== 'true';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar userId={userId ?? null} />
      <SidebarInset>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={{
            className:
              '!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]',
          }}
        />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
