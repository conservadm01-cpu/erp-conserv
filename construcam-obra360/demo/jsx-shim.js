// jsx-runtime sobre o React global (UMD da CDN).
const R = window.React;
export const Fragment = R.Fragment;
function make(type, props, key, spread) {
  const { children, ...rest } = props || {};
  if (key !== undefined) rest.key = key;
  if (children === undefined) return R.createElement(type, rest);
  return spread && Array.isArray(children) ? R.createElement(type, rest, ...children) : R.createElement(type, rest, children);
}
export const jsx = (t, p, k) => make(t, p, k, false);
export const jsxs = (t, p, k) => make(t, p, k, true);
