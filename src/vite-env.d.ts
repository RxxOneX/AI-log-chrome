/// <reference types="vite/client" />

declare module '*?script&module' {
  const src: string;
  export default src;
}

declare module '*?script' {
  const src: string;
  export default src;
}
