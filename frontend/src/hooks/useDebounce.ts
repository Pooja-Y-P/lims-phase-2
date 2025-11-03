import { useState, useEffect } from 'react';

// This is our custom hook. It's just a function that starts with "use".
// It takes a value and a delay time.
export function useDebounce<T>(value: T, delay: number): T {
  // 1. It creates its own internal state to hold the "delayed" value.
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  // 2. It uses a useEffect hook to watch for changes in the *original* value.
  useEffect(() => {
    // 3. When the original value changes, it sets a timer.
    const handler = setTimeout(() => {
      // 4. ONLY when the timer finishes (after the 'delay' time),
      //    it updates its internal state with the latest value.
      setDebouncedValue(value);
    }, delay);

    // 5. CRUCIAL: This is the cleanup function. If the original value changes again
    //    before the timer finishes, this function runs and cancels the old timer.
    //    This is what "resets" the countdown.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // This effect re-runs every time the original value changes.

  // 6. Finally, the hook returns its internal, stable, "debounced" value.
  return debouncedValue;
}