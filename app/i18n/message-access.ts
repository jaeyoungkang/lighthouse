import messages, { type MessageKey } from "./messages";

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const message: unknown = Reflect.get(messages, key);
  if (typeof message !== "string") {
    throw new Error(`Unknown message key: ${key}`);
  }
  let text = message;
  if (params) {
    for (const [placeholder, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), String(value));
    }
  }
  return text;
}

export { type MessageKey } from "./messages";
