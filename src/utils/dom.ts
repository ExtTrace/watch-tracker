export function cleanText(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  return text.length > 0 ? text : null;
}

export function getMetaContent(selector: string): string | null {
  const element = document.querySelector<HTMLMetaElement>(selector);
  return cleanText(element?.content);
}

export function getFirstText(selectors: string[]): string | null {
  for (const selector of selectors) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);

    for (const node of nodes) {
      const text = cleanText(node.textContent);
      if (text) {
        return text;
      }
    }
  }

  return null;
}
