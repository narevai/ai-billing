'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useActiveChat } from '@/hooks/use-active-chat';
import { artifactDefinitions } from './artifact';
import { useBillingCosts } from './billing-cost-provider';
import { useDataStream } from './data-stream-provider';
import { getChatHistoryPaginationKey } from './sidebar-history';

export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();
  const { mutate } = useSWRConfig();
  const { setCost } = useBillingCosts();
  const { messages } = useActiveChat();

  const { artifact, setArtifact, setMetadata } = useArtifact();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }

    const newDeltas = dataStream.slice();
    setDataStream([]);

    for (const delta of newDeltas) {
      if (delta.type === 'data-chat-title') {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        continue;
      }
      if (delta.type === 'data-billing-cost') {
        if (delta.data?.amount != null) {
          const lastAssistant = [...messages]
            .reverse()
            .find(m => m.role === 'assistant');
          if (lastAssistant?.id) {
            setCost(lastAssistant.id, {
              amount: delta.data.amount,
              currency: delta.data.currency,
            });
          }
        }
        continue;
      }
      const artifactDefinition = artifactDefinitions.find(
        currentArtifactDefinition =>
          currentArtifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact(draftArtifact => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'data-id':
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: 'streaming',
            };

          case 'data-title':
            return {
              ...draftArtifact,
              title: delta.data,
              status: 'streaming',
            };

          case 'data-kind':
            return {
              ...draftArtifact,
              kind: delta.data,
              status: 'streaming',
            };

          case 'data-clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'data-finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    }
  }, [dataStream, setArtifact, setMetadata, artifact, setDataStream, mutate]);

  return null;
}
