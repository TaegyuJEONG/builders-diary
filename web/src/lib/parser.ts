import { ParsedFrontMatter } from './types';

/**
 * Parse YAML front matter from markdown content
 * @param content Raw markdown string with front matter
 * @returns Parsed front matter and content, or null if no front matter found
 */
export function parseFrontMatter(content: string): (ParsedFrontMatter & { content: string }) | null {
  try {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      console.warn('No front matter found in markdown');
      return null;
    }

    const [, frontMatterString, markdownContent] = match;
    const frontMatter = parseFrontMatterYAML(frontMatterString);

    return {
      ...frontMatter,
      content: markdownContent.trim(),
    };
  } catch (error) {
    console.error('Error parsing front matter:', error);
    return null;
  }
}

/**
 * Parse YAML format front matter
 */
function parseFrontMatterYAML(yaml: string): ParsedFrontMatter {
  const result: any = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split(':');
    const value = valueParts.join(':').trim();

    if (!key) continue;

    // Handle arrays like [tag1, tag2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      result[key.trim()] = arrayContent
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && item !== '');
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      result[key.trim()] = value.slice(1, -1);
    }
    // Handle boolean values
    else if (value === 'true') {
      result[key.trim()] = true;
    } else if (value === 'false') {
      result[key.trim()] = false;
    }
    // Handle numeric values
    else if (!isNaN(Number(value)) && value !== '') {
      result[key.trim()] = Number(value);
    }
    // Default: string value
    else {
      result[key.trim()] = value;
    }
  }

  return result as ParsedFrontMatter;
}

/**
 * Convert markdown to HTML with basic styling
 */
export function renderMarkdown(markdown: string): string {
  try {
    // Simple markdown to HTML conversion
    let html = markdown;

    // Code blocks (must be before inline code)
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const escapedCode = code
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="bg-slate-100 p-4 rounded my-4 overflow-x-auto"><code>${escapedCode}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-2 py-1 rounded">$1</code>');

    // Headings
    html = html.replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-10 mb-5">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\- (.*?)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/^\* (.*?)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/^\d+\. (.*?)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li[^>]*>.*?<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>');

    // Line breaks and paragraphs
    const lines = html.split('\n');
    const processed = lines.map((line) => {
      if (line.trim().startsWith('<')) {
        return line;
      }
      if (!line.trim()) {
        return '<br/>';
      }
      return `<p class="my-2">${line}</p>`;
    });

    return processed.join('');
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return `<p>Error rendering markdown: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
  }
}
