import * as sanitizeHtml from 'sanitize-html';

export class SanitizeUtil {
  static sanitizeString(input: string): string {
    if (!input) return '';
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }

  static sanitizeRichText(input: string): string {
    if (!input) return '';
    return sanitizeHtml(input, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br'],
      allowedAttributes: {
        a: ['href', 'target'],
      },
    });
  }
}
