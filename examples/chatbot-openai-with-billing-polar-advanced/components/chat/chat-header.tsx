'use client';

import { PanelLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { VercelIcon } from './icons';
import { VisibilitySelector, type VisibilityType } from './visibility-selector';

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { state, toggleSidebar, isMobile } = useSidebar();

  if (state === 'collapsed' && !isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 flex h-14 items-center gap-2 bg-sidebar px-3">
      <Button
        className="md:hidden"
        onClick={toggleSidebar}
        size="icon-sm"
        variant="ghost"
      >
        <PanelLeftIcon className="size-4" />
      </Button>

      <Link
        className="flex size-8 items-center justify-center rounded-lg md:hidden"
        href="https://vercel.com/templates/next.js/chatbot"
        rel="noopener noreferrer"
        target="_blank"
      >
        <VercelIcon size={14} />
      </Link>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
        />
      )}

      <Button
        asChild
        className="hidden rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90 md:ml-auto md:flex"
      >
        <Link
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-openai-with-billing-polar&env=AUTH_SECRET,OPENAI_API_KEY,POSTGRES_URL,POLAR_ACCESS_TOKEN,POLAR_SERVER,NAREV_API_KEY&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%7D"
          rel="noopener noreferrer"
          target="_blank"
        >
          <VercelIcon size={16} />
          Deploy with Vercel
        </Link>
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
