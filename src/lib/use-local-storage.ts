import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export const useLocalStorage = <Value>(
  key: string,
  fallback: Value,
): [Value, Dispatch<SetStateAction<Value>>] => {
  const [value, setValue] = useState<Value>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as Value;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  }, [key, value]);

  return [value, setValue];
};
