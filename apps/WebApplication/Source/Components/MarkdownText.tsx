import { memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeSnippet } from "./CodeSnippet";

const DEFAULT_CODE_LANGUAGE = "text";
const CODE_LANGUAGE_CLASS_PREFIX = "language-";
const TRAILING_BLOCK_NEWLINE_PATTERN = /\n$/;
const INLINE_CODE_CLASS_NAME = "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]";

export interface MarkdownTextProps {
  text: string;
}

function detectLanguage(className: string | undefined): string {
  if (className === undefined || className.length === 0) {
    return DEFAULT_CODE_LANGUAGE;
  }
  if (!className.startsWith(CODE_LANGUAGE_CLASS_PREFIX)) {
    return DEFAULT_CODE_LANGUAGE;
  }
  const languageName = className.slice(CODE_LANGUAGE_CLASS_PREFIX.length).trim();
  return languageName.length > 0 ? languageName : DEFAULT_CODE_LANGUAGE;
}

function readCodeText(children: ReactNode): string {
  return String(children ?? "");
}

function isCodeBlock(code: string, className: string | undefined): boolean {
  if (code.includes("\n")) {
    return true;
  }
  return className?.startsWith(CODE_LANGUAGE_CLASS_PREFIX) ?? false;
}

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const code = readCodeText(children);
    const isBlock = isCodeBlock(code, className);

    if (!isBlock) {
      return (
        <code className={INLINE_CODE_CLASS_NAME}>
          {code}
        </code>
      );
    }

    return (
      <CodeSnippet
        code={code.replace(TRAILING_BLOCK_NEWLINE_PATTERN, "")}
        language={detectLanguage(className)}
      />
    );
  }
};

function MarkdownTextComponent({ text }: MarkdownTextProps): React.JSX.Element {
  return (
    <div className="markdown-content text-sm leading-relaxed text-foreground break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownText = memo(MarkdownTextComponent);
MarkdownText.displayName = "MarkdownText";
