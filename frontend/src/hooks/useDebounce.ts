// frontend/src/hooks/useDebounce.ts

import { useState, useEffect } from 'react';

/**
 * A custom React hook that debounces a value.
 * @param value The value to debounce.
 * @param delay The delay in milliseconds.
 * @returns The debounced value, which only updates after the specified delay.
 */
function useDebounce<T>(value: T, delay: number): T {
  // State to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(
    () => {
      // Set up a timer to update the debounced value after the delay has passed
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      // Cleanup function: This is called on every render if the 'value' or 'delay'
      // changes, or when the component unmounts. This is how we cancel the previous
      // timer and reset the delay.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Only re-call effect if value or delay changes
  );

  return debouncedValue;
}

export default useDebounce;