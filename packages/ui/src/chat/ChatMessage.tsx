import React from 'react';
import Markdown from 'markdown-to-jsx';
import { SparkleIcon } from '../icons.js';
import {
  userMessageRow,
  userBubble,
  assistantMessageRow,
  assistantIcon,
  assistantText,
  mdParagraph,
  mdCodeBlock,
  mdCodeLang,
  mdInlineCode,
} from './chat-styles.js';

export interface ChatMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  role: 'user' | 'assistant';
  content: string;
}

const InsideCodeBlock = React.createContext(false);

function CodeBlock({ children }: React.PropsWithChildren) {
  const arr = React.Children.toArray(children);
  const codeEl = arr.find((c): c is React.ReactElement<{ className?: string }> =>
    React.isValidElement(c),
  );
  const className = codeEl?.props.className ?? '';
  const lang = className.match(/(?:lang|language)-(\S+)/)?.[1] ?? null;

  return (
    <InsideCodeBlock.Provider value={true}>
      <pre style={mdCodeBlock}>
        {lang && <div style={mdCodeLang}>{lang}</div>}
        {children}
      </pre>
    </InsideCodeBlock.Provider>
  );
}

function Code({ children, className, style: _style, ...props }: React.HTMLAttributes<HTMLElement>) {
  const insideBlock = React.useContext(InsideCodeBlock);
  return (
    <code className={className} style={insideBlock ? undefined : mdInlineCode} {...props}>
      {children}
    </code>
  );
}

const markdownOptions = {
  overrides: {
    p:    { props: { style: mdParagraph } },
    pre:  { component: CodeBlock },
    code: { component: Code },
  },
  forceBlock: true,
};

export const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ role, content, className, style, ...props }, ref) => {
    const cls = (className ?? '').trim();

    if (role === 'user') {
      return (
        <div ref={ref} className={cls} style={{ ...userMessageRow, ...style }} {...props}>
          <div style={userBubble}>{content}</div>
        </div>
      );
    }

    return (
      <div ref={ref} className={cls} style={{ ...assistantMessageRow, ...style }} {...props}>
        <div style={assistantIcon}>
          <SparkleIcon />
        </div>
        <div style={assistantText}>
          <Markdown options={markdownOptions}>{content}</Markdown>
        </div>
      </div>
    );
  },
);
ChatMessage.displayName = 'ChatMessage';
