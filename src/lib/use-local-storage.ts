import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

const readValue = <Value>(
  key: string,
  fallback: Value,
  decode: (input: unknown) => Value | null,
): Value => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return decode(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
};

export const useLocalStorage = <Value>({
  key,
  fallback,
  decode,
}: {
  key: string;
  fallback: Value;
  decode: (input: unknown) => Value | null;
}): [Value, Dispatch<SetStateAction<Value>>] => {
  const [value, setValue] = useState<Value>(() => readValue(key, fallback, decode));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }, [key, value]);

  return [value, setValue];
};
