import { useState, useEffect } from "react";

/**
 * Hook that debounces a value by the specified delay.
 * Useful for search inputs to avoid excessive API calls.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 *
 * @example
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebouncedValue(query, 300);
 *
 * useEffect(() => {
 *   // This only runs 300ms after the user stops typing
 *   searchProducts(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
