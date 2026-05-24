const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export const getPublicAppOrigin = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.replace(/\/$/, '');
  }

  return window.location.origin;
};

export const resolvePublicAppUrl = (url: string): string => {
  if (!url) {
    return url;
  }

  const publicOrigin = getPublicAppOrigin();

  try {
    const parsed = new URL(url);
    if (LOCAL_HOSTNAMES.has(parsed.hostname) && publicOrigin) {
      return `${publicOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }

  return url;
};

export const copyFromInput = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
  if (!input) {
    return false;
  }

  input.focus();
  input.select();
  input.setSelectionRange(0, input.value.length);

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API can fail in dialogs or after async work.
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
};

export const copyInviteUrl = async (
  inviteUrl: string,
  input?: HTMLInputElement | HTMLTextAreaElement | null
): Promise<boolean> => {
  if (input && copyFromInput(input)) {
    return true;
  }

  return copyTextToClipboard(inviteUrl);
};
