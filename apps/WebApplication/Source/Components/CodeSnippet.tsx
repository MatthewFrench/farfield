import { type CSSProperties, memo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/Features/Theme/StateManagement/UseTheme";

const DEFAULT_SNIPPET_LANGUAGE = "text";

const CODE_SNIPPET_STYLE: CSSProperties = {
  margin: 0,
  padding: "0.75rem",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
  lineHeight: "1.4",
};

export interface CodeSnippetProps {
  code: string;
  language: string;
  wrapLongLines?: boolean;
  className?: string;
}

function readSnippetLanguage(language: string): string {
  const trimmedLanguage = language.trim();
  return trimmedLanguage.length > 0 ? trimmedLanguage : DEFAULT_SNIPPET_LANGUAGE;
}

function CodeSnippetComponent({
  code,
  language,
  wrapLongLines = true,
  className,
}: CodeSnippetProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <div className={className}>
      <SyntaxHighlighter
        language={readSnippetLanguage(language)}
        style={theme === "dark" ? oneDark : oneLight}
        customStyle={CODE_SNIPPET_STYLE}
        wrapLongLines={wrapLongLines}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export const CodeSnippet = memo(CodeSnippetComponent);
CodeSnippet.displayName = "CodeSnippet";
