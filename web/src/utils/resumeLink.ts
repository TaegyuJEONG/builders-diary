export function generateResumeLink(baseUrl: string, type: 'record' | 'project' | 'goal', id: string, projectId?: string, goalId?: string): string {
  switch (type) {
    case 'record':
      return `${baseUrl}/r/${id}`;
    case 'project':
      return `${baseUrl}/p/${id}`;
    case 'goal':
      if (!projectId) throw new Error('projectId is required for goal links');
      return `${baseUrl}/p/${projectId}/g/${id}`;
    default:
      return baseUrl;
  }
}

export function parseDeepLink(pathname: string, search: string): { type: string; projectId?: string; goalId?: string; recordId?: string } {
  const match = pathname.match(/^\/([rpg])(?:\/([a-zA-Z0-9\-]+))?(?:\/g\/([a-zA-Z0-9\-]+))?$/);
  
  if (!match) {
    return { type: 'home' };
  }

  const [, type, id1, id2] = match;

  if (type === 'r') {
    return { type: 'record', recordId: id1 };
  } else if (type === 'p') {
    return { type: 'project', projectId: id1, goalId: id2 };
  } else if (type === 'g') {
    return { type: 'goal', projectId: id1, goalId: id2 };
  }

  return { type: 'home' };
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
