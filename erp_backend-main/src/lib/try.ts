export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  finallyFn?: () => void | Promise<void>,
): Promise<{ data?: T; error?: unknown }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    return { error };
  } finally {
    await finallyFn?.();
  }
}

export function tryCatch<T>(fn: () => T, finallyFn?: () => void): { data?: T; error?: unknown } {
  try {
    const data = fn();
    return { data };
  } catch (error) {
    return { error };
  } finally {
    finallyFn?.();
  }
}
