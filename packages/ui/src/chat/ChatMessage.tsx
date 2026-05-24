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
  mdH1,
  mdH2,
  mdH3,
  mdH4,
  mdUl,
  mdOl,
  mdLi,
  mdStrong,
  mdEm,
  mdA,
  mdBlockquote,
  mdTable,
  mdTh,
  mdTd,
  mdHr,
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
  const codeEl = arr.find(
    (c): c is React.ReactElement<{ className?: string }> =>
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

function Code({
  children,
  className,
  style: _style,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const insideBlock = React.useContext(InsideCodeBlock);
  return (
    <code
      className={className}
      style={insideBlock ? undefined : mdInlineCode}
      {...props}
    >
      {children}
    </code>
  );
}

const markdownOptions = {
  overrides: {
    p: { props: { style: mdParagraph } },
    h1: { props: { style: mdH1 } },
    h2: { props: { style: mdH2 } },
    h3: { props: { style: mdH3 } },
    h4: { props: { style: mdH4 } },
    ul: { props: { style: mdUl } },
    ol: { props: { style: mdOl } },
    li: { props: { style: mdLi } },
    strong: { props: { style: mdStrong } },
    b: { props: { style: mdStrong } },
    em: { props: { style: mdEm } },
    i: { props: { style: mdEm } },
    a: { props: { style: mdA } },
    blockquote: { props: { style: mdBlockquote } },
    table: { props: { style: mdTable } },
    th: { props: { style: mdTh } },
    td: { props: { style: mdTd } },
    hr: { props: { style: mdHr } },
    pre: { component: CodeBlock },
    code: { component: Code },
  },
  forceBlock: true,
};

export const ChatMessage = React.forwardRef<HTMLDivElement, ChatMessageProps>(
  ({ role, content, className, style, ...props }, ref) => {
    const cls = (className ?? '').trim();

    if (role === 'user') {
      return (
        <div
          ref={ref}
          className={cls}
          style={{ ...userMessageRow, ...style }}
          {...props}
        >
          <div style={userBubble}>{content}</div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cls}
        style={{ ...assistantMessageRow, ...style }}
        {...props}
      >
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
