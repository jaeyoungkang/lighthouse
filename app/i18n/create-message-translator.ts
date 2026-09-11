export function createMessageTranslator<TMessages extends Readonly<Record<string, string>>>(
  messages: TMessages,
) {
  return function translate(
    key: keyof TMessages,
    params?: Record<string, string | number>,
  ): string {
    let text: string = messages[key];
    if (params) {
      for (const [placeholder, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), String(value));
      }
    }
    return text;
  };
}
