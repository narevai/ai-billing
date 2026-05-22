'use client';

import { useState } from 'react';
import { updateChatVisibility } from '@/app/(chat)/actions';
import type { VisibilityType } from '@/components/chat/visibility-selector';

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const [visibilityType, setVisibilityTypeState] = useState<VisibilityType>(initialVisibilityType);

  const setVisibilityType = (visibility: VisibilityType) => {
    setVisibilityTypeState(visibility);
    updateChatVisibility({ chatId, visibility });
  };

  return { visibilityType, setVisibilityType };
}
