/**
 * Type declarations for marked-terminal namespace pattern.
 */

export interface HeadingStyle {
  level?: number[];
  style?: string;
  levels?: Record<number | 'all', string>;
  prefix?: string[] | ((level: number) => string);
  suffix?: string;
  blankLineBefore?: boolean;
  enabled?: boolean;
  renderer?: (level: number, text: string) => string;
}

export interface HighlightOptions {
  theme?: string;
  langPrefix?: string;
  enabled?: boolean;
  renderer?: (lang: string | undefined, code: string) => string;
  highlightOptions?: {
    language?: string;
    theme?: string;
    ignoreMissing?: boolean;
    noHighlight?: boolean;
    guessLanguage?: boolean;
  };
}

export interface TerminalRendererOptions {
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
  customRenderers?: {
    heading?: HeadingStyle['renderer'];
    inlineCode?: any;
    blockquote?: any;
    list?: any;
    table?: any;
    hr?: any;
  };
  enabled?: boolean;
}

declare function markedTerminal(options: Partial<TerminalRendererOptions>[]): MarkedExtension;
declare function highlighted(highlightOptions?: HighlightOptions): MarkedExtension;
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

export interface MarkedExtension {
  renderer: Record<string, any>;
  useNewRenderer: true;
}
