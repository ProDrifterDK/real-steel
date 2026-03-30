/**
 * Type definitions for marked-terminal v7.3.0+
 * 
 * This file provides type safety for the marked-terminal namespace pattern.
 */

// ============================================================================
// MARKED-TERMINAL NAMESPACE TYPES (v7+)
// ============================================================================

/**
 * Options for rendering headings in the terminal.
 */
export interface HeadingStyle {
  /** Array of heading levels to render (default: [1, 2, 3, 4, 5, 6]) */
  level?: number[];

  /** Style for all headings (e.g., 'cyan.bold', 'green.underline') */
  style?: string;

  /** Individual styles per heading level (overrides global style) */
  levels?: Record<number | 'all', string>;

  /** Prefix characters or functions for each heading level */
  prefix?: string[] | ((level: number) => string);

  /** Suffix to append after the heading content */
  suffix?: string;

  /** Whether to include a blank line before headings */
  blankLineBefore?: boolean;

  /** Whether to render headings at all (useful for toggling feature on/off) */
  enabled?: boolean;

  /** Custom renderer function for complete control over heading rendering */
  renderer?: (level: number, text: string) => string;
}

/**
 * Options for rendering code blocks with syntax highlighting.
 */
export interface HighlightOptions {
  /** Theme name for syntax highlighting */
  theme?: string;

  /** Language identifier prefix in the HTML output */
  langPrefix?: string;

  /** Whether to enable code block highlighting */
  enabled?: boolean;

  /** Custom renderer function for code blocks */
  renderer?: (lang: string | undefined, code: string) => string;

  /** Options passed directly to cli-highlight */
  highlightOptions?: {
    language?: string;
    theme?: string;
    ignoreMissing?: boolean;
    noHighlight?: boolean;
    guessLanguage?: boolean;
  };
}

/**
 * Complete configuration object for marked-terminal.
 */
export interface TerminalRendererOptions {
  heading?: HeadingStyle;
  inlineCode?: { style?: string; showBackticks?: boolean; renderer?: (code: string) => string; enabled?: boolean };
  blockquote?: { style?: string; prefix?: string | ((level: number) => string); suffix?: string; nestLevelPrefix?: boolean; maxNestLevel?: number; enabled?: boolean };
  list?: { unorderedStyle?: 'dash' | 'dot' | 'circle'; bulletChar?: string; orderedStyle?: true | false | '1.' | '1)' | 'a.' | 'A.' | 'i.' | 'I.'; indentItem?: boolean; renderer?: (body: string, ordered: boolean) => string; enabled?: boolean };
  table?: { delimiterColumn?: string | ((columnIndex: number) => string); delimiterRow?: [string, string, string] | string; padding?: [number, number]; headerAlign?: ('left' | 'center' | 'right')[]; alignHeader?: boolean; renderer?: (table: string, options: { padding: [number, number] }) => string; enabled?: boolean };
  hrule?: { style?: string; char?: string | ((index: number) => string); enabled?: boolean };

  /** Global style applied to all elements */
  globalStyle?: string;

  /** Whether to enable emoji rendering (requires emoji library) */
  emoji?: boolean;

  /** Options passed to cli-highlight for code blocks */
  highlightOptions?: HighlightOptions;

  /** Reflow text to fit terminal width when enabled */
  reflowText?: boolean;

  /** Terminal width for reflow calculations */
  width?: number;

  /** Whether to unescape HTML entities (e.g., &quot; → ") */
  unescape?: boolean;

  /** Custom renderer functions that override all built-in renderers */
  customRenderers?: {
    heading?: HeadingStyle['renderer'];
    inlineCode?: InlineCodeStyle['renderer'];
    blockquote?: BlockquoteStyle['renderer'];
    list?: ListStyle['renderer'];
    table?: TableStyle['renderer'];
    hr?: HRuleStyle;
  };

  /** Whether to render at all */
  enabled?: boolean;
}

// ============================================================================
// MARKED-TERMINAL NAMESPACE (actual exports from marked-terminal)
// ============================================================================

/**
 * Creates a marked-terminal extension with the given options.
 * 
 * This function can be passed to `marked.use()` to configure markdown rendering.
 */
declare function markedTerminal(options: Partial<TerminalRendererOptions>[]): MarkedExtension;

/**
 * Creates a syntax highlighting extension that integrates with cli-highlight.
 */
declare function highlighted(highlightOptions?: HighlightOptions): MarkedExtension;

// ============================================================================
// DEFAULT OPTIONS (exposed from marked-terminal namespace)
// ============================================================================

export declare const defaultOptions: {
  heading?: HeadingStyle;
  inlineCode?: any;
  blockquote?: any;
  list?: any;
  table?: any;
  hrule?: any;
  globalStyle?: string;
  emoji?: boolean;
  highlightOptions?: HighlightOptions;
  reflowText?: boolean;
  width?: number;
  unescape?: boolean;
};
