import TurndownService from 'turndown';

export function createTurndownService(): TurndownService {
  return new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  });
}
