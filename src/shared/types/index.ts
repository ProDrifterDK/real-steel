/**
 * Type declarations for marked-terminal namespace pattern.
 */

export interface HeadingStyle {
  level?: number[];
  style?: string;
  prefix?: string[];
}

export interface HighlightOptions {
  theme?: string;
}

export interface TerminalRendererOptions extends Partial<{
  heading: HeadingStyle;
}> {}

export interface MarkedExtension {
  renderer: Record<string, any>;
  useNewRenderer: true;
}

declare function markedTerminal(options: Partial<TerminalRendererOptions>): MarkedExtension;
declare function highlighted(highlightOptions?: HighlightOptions): MarkedExtension;
