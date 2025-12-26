// DOMMatrix polyfill for serverless environments (Vercel, AWS Lambda, etc.)
// pdfjs-dist requires DOMMatrix which is not available in Node.js/serverless environments
// This must be imported before any pdfjs-dist imports

if (typeof window === 'undefined') {
  // Set up on globalThis (ES2020+ standard)
  if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor() {
        // Minimal implementation for pdfjs-dist compatibility
      }
      static fromMatrix() {
        return new DOMMatrix();
      }
    } as any;
  }
  
  // Also set up on global for Node.js compatibility
  if (typeof global !== 'undefined' && typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = globalThis.DOMMatrix;
  }
  
  // Set up on self for web worker compatibility
  if (typeof self !== 'undefined' && typeof self.DOMMatrix === 'undefined') {
    self.DOMMatrix = globalThis.DOMMatrix;
  }
}

