/**
 * Marked Terminal Configuration Module
 * 
 * Centralized configuration for rendering markdown in the terminal.
 */

import { marked } from 'marked';
import type { HeadingStyle, HighlightOptions, MarkedExtension } from './types/index.js';

// ============================================================================
// TYPES - Inline definitions (referenced by types)
// ============================================================================

export interface MarkedHeadingConfig extends Partial<{
  enabled?: boolean;
  level: number[];
  style: string;
  prefix: string[];
}> {
}

export interface MarkedCodeConfig extends Partial<{
  enabled?: boolean;
  theme: string;
}> {
}

export interface MarkedEmojiConfig extends Partial<{
  enabled?: boolean;
  useEmojiRegex?: boolean;
}> {
}

export interface MarkedConfig {
  heading?: MarkedHeadingConfig;
  codeSnippet?: MarkedCodeConfig;
  emoji?: MarkedEmojiConfig;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_MARKED_CONFIG: MarkedConfig = {
  heading: {
    enabled: true,
    level: [1, 2],
    style: 'cyan.bold',
    prefix: ['# ', '# ', '# '],
  },
  codeSnippet: {
    enabled: true,
    theme: 'native',
  },
  emoji: {
    enabled: true,
    useEmojiRegex: false, // Use marked-terminal's built-in emoji support
  },
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let _initialized = false;
let _highlightOptions: HighlightOptions | null = null;
let _emojiEnabled: boolean = true;

// Track actual emoji configuration passed to marked-terminal
let _actualEmojiConfig: { enabled?: boolean } | null = null;

// ============================================================================
// CONFIGURATION FUNCTIONS (Async - use dynamic import for flexibility)
// ============================================================================

export async function configureMarkdown(overrides: MarkedConfig = {}): Promise<MarkedConfig> {
  if (_initialized) {
    return DEFAULT_MARKED_CONFIG;
  }

  // Get theme from overrides or use default
  const highlightTheme = overrides.codeSnippet?.theme ?? 'native';
  
  // Get emoji config - always have a value (use defaults if undefined)
  _emojiEnabled = overrides.emoji?.enabled !== false; // Default to true if not specified
  
  // Track actual emoji configuration passed to marked-terminal
  _actualEmojiConfig = { enabled: _emojiEnabled };

  _initialized = true;
  
  // Return a properly merged config with overrides applied
  const headingOpts: Partial<MarkedHeadingConfig> = {
    ...DEFAULT_MARKED_CONFIG.heading,
    ...overrides.heading,
  };
  
  const codeSnippetOpts: Partial<MarkedCodeConfig> = {
    ...DEFAULT_MARKED_CONFIG.codeSnippet,
    ...overrides.codeSnippet,
  };

  return {
    heading: headingOpts as MarkedHeadingConfig,
    codeSnippet: codeSnippetOpts as MarkedCodeConfig,
    emoji: DEFAULT_MARKED_CONFIG.emoji, // Always return defaults for consistency
  } as MarkedConfig;
}

export async function resetMarkdownConfig(): Promise<void> {
  // Note: marked doesn't provide a clear API to undo changes, so we reset our state
  _initialized = false;
  _highlightOptions = null;
  _emojiEnabled = true;
  _actualEmojiConfig = null;
  
  // Attempt to clear marked's defaults if available
  (marked as any).setDefaults?.({});
}

export async function isConfigured(): Promise<boolean> {
  return _initialized;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse a message with the configured markdown renderer.
 */
export function parseMarkdown(content: string): string {
  const result = marked.parse(content);
  // marked.parse() returns HTML as string, not Promise
  return (result as any).toString?.() || result;
}

/**
 * Check if emoji support is enabled in the markdown configuration.
 */
export function isEmojiEnabled(): boolean {
  // First check our tracked config from marked-terminal call
  if (_actualEmojiConfig !== null) {
    return _actualEmojiConfig.enabled !== false;
  }
  
  // Fall back to our default state
  return _emojiEnabled;
}

/**
 * Get the current highlight options for code blocks.
 */
export function getHighlightOptions(): HighlightOptions | null {
  return _highlightOptions;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default configureMarkdown;
