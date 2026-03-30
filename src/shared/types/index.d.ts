/**
 * Type declarations for marked-terminal namespace pattern.
 */

interface HeadingStyle {
  level?: number[];
  style?: string;
}

interface HighlightOptions {
  theme?: string;
}

interface TerminalRendererOptions {
  heading?: HeadingStyle;
}

interface MarkedExtension {
  renderer: Record<string, any>;
  useNewRenderer: true;
}

declare function markedTerminal(options: Partial<TerminalRendererOptions>[]): MarkedExtension;
declare function highlighted(highlightOptions?: HighlightOptions): MarkedExtension;
