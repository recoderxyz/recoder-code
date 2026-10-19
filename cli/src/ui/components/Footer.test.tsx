/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { Footer } from './Footer.js';
import * as useTerminalSize from '../hooks/useTerminalSize.js';
import { tildeifyPath } from 'recoder-code-core';
import path from 'node:path';

vi.mock('../hooks/useTerminalSize.js');
const useTerminalSizeMock = vi.mocked(useTerminalSize.useTerminalSize);

vi.mock('recoder-code-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('recoder-code-core')>();
  return {
    ...original,
    shortenPath: (p: string, len: number) => {
      if (p.length > len) {
        return '...' + p.slice(p.length - len + 3);
      }
      return p;
    },
  };
});

const defaultProps = {
  model: 'gemini-pro',
  targetDir:
    '/Users/test/project/foo/bar/and/some/more/directories/to/make/it/long',
  branchName: 'main',
  debugMode: false,
  debugMessage: '',
  corgiMode: false,
  errorCount: 0,
  showErrorDetails: false,
  showMemoryUsage: false,
  promptTokenCount: 100,
  nightly: false,
};

const renderWithWidth = (width: number, props = defaultProps) => {
  useTerminalSizeMock.mockReturnValue({ columns: width, rows: 24 });
  return render(<Footer {...props} />);
};

const normalizeFrame = (output: string) => output.replace(/\s+/g, '');

describe('<Footer />', () => {
  it('renders the component', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toBeDefined();
  });

  describe('path display', () => {
    it('should display shortened path on a wide terminal', () => {
      const { lastFrame } = renderWithWidth(120);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const pathLength = Math.max(20, Math.floor(120 * 0.4));
      const expectedPath = '...' + tildePath.slice(tildePath.length - pathLength + 3);
      const expectedPrefix = expectedPath.slice(0, -2);
      expect(normalizeFrame(lastFrame())).toContain(
        normalizeFrame(expectedPrefix),
      );
    });

    it('should display only the base directory name on a narrow terminal', () => {
      const { lastFrame } = renderWithWidth(79);
      const expectedPath = path.basename(defaultProps.targetDir);
      expect(lastFrame()).toContain(expectedPath);
    });

    it('should use wide layout at 80 columns', () => {
      const { lastFrame } = renderWithWidth(80);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const pathLength = Math.max(20, Math.floor(80 * 0.4));
      const expectedPath = '...' + tildePath.slice(tildePath.length - pathLength + 3);
      expect(normalizeFrame(lastFrame())).toContain(
        normalizeFrame(expectedPath),
      );
    });

    it('should use narrow layout at 79 columns', () => {
      const { lastFrame } = renderWithWidth(79);
      const expectedPath = path.basename(defaultProps.targetDir);
      expect(lastFrame()).toContain(expectedPath);
      const tildePath = tildeifyPath(defaultProps.targetDir);
      const unexpectedPath = '...' + tildePath.slice(tildePath.length - 31 + 3);
      expect(normalizeFrame(lastFrame())).not.toContain(
        normalizeFrame(unexpectedPath),
      );
    });
  });

  it('displays the branch name when provided', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toContain(`(${defaultProps.branchName}*)`);
  });

  it('does not display the branch name when not provided', () => {
    const { lastFrame } = renderWithWidth(120, {
      ...defaultProps,
      branchName: undefined,
    });
    expect(lastFrame()).not.toContain(`(${defaultProps.branchName}*)`);
  });

  it('displays the model name and context percentage', () => {
    const { lastFrame } = renderWithWidth(120);
    expect(lastFrame()).toContain(defaultProps.model);
    expect(lastFrame()).toMatch(/\(\d+% context[\s\S]*left\)/);
  });

  describe('sandbox and trust info', () => {
    it('should display untrusted when isTrustedFolder is false', () => {
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        isTrustedFolder: false,
      });
      expect(lastFrame()).toContain('untrusted');
    });

    it('should display custom sandbox info when SANDBOX env is set', () => {
      vi.stubEnv('RECODER_SANDBOX', 'gemini-cli-test-sandbox');
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        isTrustedFolder: undefined,
      });
      expect(lastFrame()).toContain('test-sandbox');
      vi.unstubAllEnvs();
    });

    it('should display macOS Seatbelt info when SANDBOX is sandbox-exec', () => {
      vi.stubEnv('RECODER_SANDBOX', 'sandbox-exec');
      vi.stubEnv('SEATBELT_PROFILE', 'test-profile');
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        isTrustedFolder: true,
      });
      expect(lastFrame()).toMatch(/macOS Seatbelt.*\(test-profile\)/s);
      vi.unstubAllEnvs();
    });

    it('should display interactive mode when SANDBOX is not set and folder is trusted', () => {
      vi.stubEnv('RECODER_SANDBOX', '');
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        isTrustedFolder: true,
      });
      expect(lastFrame()).toContain('Interactive Mode');
      vi.unstubAllEnvs();
    });

    it('should prioritize untrusted message over sandbox info', () => {
      vi.stubEnv('RECODER_SANDBOX', 'gemini-cli-test-sandbox');
      const { lastFrame } = renderWithWidth(120, {
        ...defaultProps,
        isTrustedFolder: false,
      });
      expect(lastFrame()).toContain('untrusted');
      expect(lastFrame()).not.toMatch(/test-sandbox/s);
      vi.unstubAllEnvs();
    });
  });
});
