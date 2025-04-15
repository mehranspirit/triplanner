import { Mark, mergeAttributes } from '@tiptap/core';

export interface UserHighlightOptions {
  HTMLAttributes: Record<string, any>;
  user: {
    _id: string;
    name: string;
    photoUrl?: string | null;
  } | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    userHighlight: {
      setUserHighlight: () => ReturnType;
      unsetUserHighlight: () => ReturnType;
    };
  }
}

export const UserHighlight = Mark.create<UserHighlightOptions>({
  name: 'userHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
      user: null,
    };
  },

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: element => element.getAttribute('data-user-id'),
        renderHTML: attributes => {
          if (!attributes.userId) {
            return {};
          }
          return {
            'data-user-id': attributes.userId,
          };
        },
      },
      userName: {
        default: null,
        parseHTML: element => element.getAttribute('data-user-name'),
        renderHTML: attributes => {
          if (!attributes.userName) {
            return {};
          }
          return {
            'data-user-name': attributes.userName,
          };
        },
      },
      userPhotoUrl: {
        default: null,
        parseHTML: element => element.getAttribute('data-user-photo'),
        renderHTML: attributes => {
          if (!attributes.userPhotoUrl) {
            return {};
          }
          return {
            'data-user-photo': attributes.userPhotoUrl,
            style: `--avatar-url: url(${attributes.userPhotoUrl})`,
          };
        },
      },
      color: {
        default: null,
        parseHTML: element => element.getAttribute('data-color'),
        renderHTML: attributes => {
          const styles = [];
          if (attributes.color) {
            styles.push(`background-color: ${attributes.color}`);
          }
          if (attributes.userPhotoUrl) {
            styles.push(`--avatar-url: url(${attributes.userPhotoUrl})`);
          }
          return {
            'data-color': attributes.color,
            style: styles.join(';'),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-user-highlight]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-user-highlight': '' });
    const styles = [];
    if (attrs.style) {
      styles.push(attrs.style);
    }
    if (attrs['data-user-photo']) {
      styles.push(`--avatar-url: url(${attrs['data-user-photo']})`);
    }
    if (styles.length > 0) {
      attrs.style = styles.join(';');
    }
    return ['span', attrs, 0];
  },

  addCommands() {
    return {
      setUserHighlight:
        () =>
        ({ commands }) => {
          if (!this.options.user) return false;
          const { _id, name, photoUrl } = this.options.user;
          const color = generateUserColor(_id);
          return commands.setMark(this.name, {
            userId: _id,
            userName: name,
            userPhotoUrl: photoUrl,
            color,
          });
        },
      unsetUserHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

// Generate a pastel color based on user ID
const generateUserColor = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsla(${hue}, 70%, 85%, 0.5)`;
}; 