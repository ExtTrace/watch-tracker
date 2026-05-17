export function debounce<T extends (...args: any[]) => void>(
  callback: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      callback(...args);
    }, delayMs);
  };
}
