/**
 * Recoder CLI Header Component
 */

import type React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { shortAsciiLogo, longAsciiLogo, tinyAsciiLogo, RECODER_LINKS } from './AsciiArt.js';
import { getAsciiArtWidth } from '../utils/textUtils.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface HeaderProps {
  customAsciiArt?: string;
  version: string;
  nightly: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  version,
  nightly,
}) => {
  const { columns: terminalWidth } = useTerminalSize();
  let displayTitle;
  const widthOfLongLogo = getAsciiArtWidth(longAsciiLogo);
  const widthOfShortLogo = getAsciiArtWidth(shortAsciiLogo);

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else if (terminalWidth >= widthOfLongLogo) {
    displayTitle = longAsciiLogo;
  } else if (terminalWidth >= widthOfShortLogo) {
    displayTitle = shortAsciiLogo;
  } else {
    displayTitle = tinyAsciiLogo;
  }

  const artWidth = getAsciiArtWidth(displayTitle);

  return (
    <Box
      alignItems="flex-start"
      width={artWidth}
      flexShrink={0}
      flexDirection="column"
    >
      {Colors.GradientColors ? (
        <Gradient colors={Colors.GradientColors}>
          <Text>{displayTitle}</Text>
        </Gradient>
      ) : (
        <Text>{displayTitle}</Text>
      )}
      <Box flexDirection="row" justifyContent="center" width="100%" marginTop={1}>
        <Text color="#f97316">🌐 </Text>
        <Text color="#a855f7">{RECODER_LINKS.website}</Text>
        <Text color="gray">  •  </Text>
        <Text color="#f97316">𝕏 </Text>
        <Text color="#a855f7">{RECODER_LINKS.twitter}</Text>
      </Box>
      {nightly && (
        <Box width="100%" flexDirection="row" justifyContent="flex-end">
          {Colors.GradientColors ? (
            <Gradient colors={Colors.GradientColors}>
              <Text>v{version}</Text>
            </Gradient>
          ) : (
            <Text>v{version}</Text>
          )}
        </Box>
      )}
    </Box>
  );
};
