'use client';

import { SignIn, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function SignInDialog({
  open,
  onOpenChange,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  useEffect(() => {
    if (isSignedIn && isOpen) {
      setOpen(false);
      router.refresh();
    }
  }, [isSignedIn, isOpen, setOpen, router]);

  return (
    <Dialog onOpenChange={setOpen} open={isOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-fit p-0 border-0 bg-transparent shadow-none">
        <DialogTitle className="sr-only">Sign in</DialogTitle>
        <SignIn routing="hash" />
      </DialogContent>
    </Dialog>
  );
}
