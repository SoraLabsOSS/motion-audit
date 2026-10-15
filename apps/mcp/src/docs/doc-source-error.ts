export class DocSourceError extends Error {
  cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "DocSourceError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
