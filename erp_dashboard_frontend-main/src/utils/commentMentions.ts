// Упоминания в комментариях. В поле ввода видно "@Имя Фамилия", в тексте комментария
// сохраняется "@[Имя Фамилия](id)": по id сервер находит, кому отправить уведомление.

export type CommentMention = { id: string; label: string };

export type CommentTextPart =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; id: string };

const MENTION_PATTERN = /@\[([^\]\n]{1,100})\]\(([0-9a-fA-F-]{36})\)/g;
// Упоминание набирается сейчас: "@" в начале строки или после пробела и буквы до курсора.
const MENTION_QUERY_PATTERN = /(?:^|\s)@([^\s@]{0,30})$/;

/**
 * Что пользователь набирает после "@" перед курсором, и где стоит "@". null — упоминание не набирается.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const match = text.slice(0, caret).match(MENTION_QUERY_PATTERN);
  if (!match) return null;
  return { query: match[1], start: caret - match[1].length - 1 };
}

/**
 * Перед отправкой: выбранные из списка "@Имя" превращаются в "@[Имя](id)".
 * Длинные имена заменяются первыми, чтобы "@Анна" не съела начало "@Анна Петрова".
 */
export function encodeMentions(text: string, mentions: CommentMention[]): string {
  const unique = new Map(mentions.map((mention) => [mention.label, mention]));
  const sorted = [...unique.values()].sort(
    (left, right) => right.label.length - left.label.length,
  );
  const placeholders: string[] = [];
  let result = text;

  for (const mention of sorted) {
    const token = `@${mention.label}`;
    if (!result.includes(token)) continue;
    // Временная метка не даёт следующей замене найти имя внутри уже закодированного упоминания.
    const placeholder = `\u0000${placeholders.length}\u0000`;
    placeholders.push(`@[${mention.label}](${mention.id})`);
    result = result.split(token).join(placeholder);
  }

  return placeholders.reduce(
    (current, encoded, index) => current.split(`\u0000${index}\u0000`).join(encoded),
    result,
  );
}

export function mentionsToPlainText(text: string): string {
  return text.replace(MENTION_PATTERN, '@$1');
}

export function splitMentions(text: string): CommentTextPart[] {
  const parts: CommentTextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    parts.push({ type: 'mention', value: `@${match[1]}`, id: match[2] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) });
  return parts;
}
