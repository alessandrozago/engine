import url from 'url';

import TurndownService from 'turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();
turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

export default async function filter(content, { fetch: location, select: extractionSelectors = [], remove: deletionSelectors = [], filter: serviceSpecificFilters = [] }, filterFunctions) {
  const { document: webPageDOM } = new JSDOM(content).window;

  serviceSpecificFilters.forEach(filterName => {
    // Filters work in place
    filterFunctions[filterName](webPageDOM);
  });

  convertRelativeURLsToAbsolute(webPageDOM, location);

  [].concat(deletionSelectors).forEach(elementSelector => {
    if (typeof elementSelector === 'object') {
      const rangeSelection = getRangeSelection(webPageDOM, elementSelector);
      rangeSelection.deleteContents();
    } else {
      Array.from(webPageDOM.querySelectorAll(elementSelector)).forEach(node => node.remove());
    }
  });

  const selectedContents = [];

  [].concat(extractionSelectors).forEach(elementSelector => {
    if (typeof elementSelector === 'object') {
      const rangeSelection = getRangeSelection(webPageDOM, elementSelector);
      selectedContents.push(rangeSelection.cloneContents());
    } else {
      selectedContents.push(...Array.from(webPageDOM.querySelectorAll(elementSelector)));
    }
  });

  if (!selectedContents.length) {
    throw new Error(`The provided selector "${extractionSelectors}" has no match in the web page.`);
  }

  return selectedContents.map(domFragment => turndownService.turndown(domFragment)).join('\n');
}

function getRangeSelection(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  const selection = document.createRange();
  const startNode = document.querySelector(startBefore || startAfter);
  const endNode = document.querySelector(endBefore || endAfter);

  if (!startNode) {
    throw new Error(`The "start" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  if (!endNode) {
    throw new Error(`The "end" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  selection[startBefore ? 'setStartBefore' : 'setStartAfter'](startNode);
  selection[endBefore ? 'setEndBefore' : 'setEndAfter'](endNode);

  return selection;
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}
