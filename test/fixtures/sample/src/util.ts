import padStart from "left-pad";

export function formatMessage(name: string): string {
  return padStart(`hello ${name}`, 20);
}

export const GREETING = "hi";
