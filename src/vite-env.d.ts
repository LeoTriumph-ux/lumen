/// <reference types="vite/client" />

declare global {
  interface Window {
    lumen: import('./lib/api').LumenAPI;
  }
}

export {};
