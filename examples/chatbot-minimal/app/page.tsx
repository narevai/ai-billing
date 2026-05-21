'use client';

import { Chat, CreditUsagePolar, CreditTopUpPolar } from '@ai-billing/nextjs';

const ANONYMOUS_USER_ID = 'anonymous_user';

export default function Home() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Chat
            userId={ANONYMOUS_USER_ID}
            placeholder="Ask anything..."
            title="What can I help with?"
            subtitle="Ask a question, write code, or explore ideas."
            examplePrompts={[
              'What are the advantages of using Next.js?',
              "Write code to demonstrate Dijkstra's algorithm",
              'Help me write an essay about Silicon Valley',
              'What is the weather in San Francisco?',
            ]}
          />
        </div>
        <div
          style={{
            width: '340px',
            flexShrink: 0,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
          }}
        >
          <CreditUsagePolar userId={ANONYMOUS_USER_ID} />
          <CreditTopUpPolar userId={ANONYMOUS_USER_ID} />
        </div>
      </div>
    </div>
  );
}
