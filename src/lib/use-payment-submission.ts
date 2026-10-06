import { useCallback, useRef, useState } from "react";

export function usePaymentSubmission() {
  const locked = useRef(false);
  const [sending, setSending] = useState(false);
  function begin() {
    if (locked.current) return false;
    locked.current = true;
    setSending(true);
    return true;
  }
  const reset = useCallback(() => {
    locked.current = false;
    setSending(false);
  }, []);
  return { sending, begin, reset };
}
