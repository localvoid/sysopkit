export function latch<T>(): (value?: T) => boolean {
  let v = false;
  return (value?: T) => {
    if (value) {
      v = true;
    }
    return v;
  };
}
