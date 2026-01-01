/**
 * Detects and extracts file paths from user input
 * Supports drag & drop paste from file managers
 */

export interface DetectedPath {
  path: string;
  quoted: boolean;
}

export function detectFilePaths(input: string): DetectedPath[] {
  const paths: DetectedPath[] = [];
  
  // Pattern 1: Quoted paths (handles spaces)
  const quotedRegex = /["']([\/\\][\w\s\/\\.-]+|[A-Z]:[\/\\][\w\s\/\\.-]+)["']/g;
  let match;
  
  while ((match = quotedRegex.exec(input)) !== null) {
    paths.push({ path: match[1], quoted: true });
  }
  
  // Pattern 2: Unquoted paths (no spaces)
  const unquotedRegex = /(?:^|\s)([\/\\][\w\/\\.-]+|[A-Z]:[\/\\][\w\/\\.-]+)(?=\s|$)/g;
  
  while ((match = unquotedRegex.exec(input)) !== null) {
    const path = match[1];
    // Avoid duplicates from quoted matches
    if (!paths.some(p => p.path === path)) {
      paths.push({ path, quoted: false });
    }
  }
  
  return paths;
}

export function formatPathsForDisplay(paths: DetectedPath[]): string {
  if (paths.length === 0) return '';
  
  const lines = [
    `\n📁 Detected ${paths.length} file path(s):`,
    ...paths.map(p => `   ${p.path}`),
    ''
  ];
  
  return lines.join('\n');
}
