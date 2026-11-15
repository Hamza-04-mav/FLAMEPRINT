/**
 * Wrap a dynamic import() so a transient chunk-load failure retries once before
 * giving up. In dev, editing a lazily-loaded module can leave the running page
 * pointing at a stale chunk URL (ChunkLoadError); the retry + the <Safe3D> boundary
 * keep that from crashing the view. Production builds have stable hashes.
 */
export function lazyRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().catch(
      (err) =>
        new Promise<T>((resolve, reject) => {
          setTimeout(() => factory().then(resolve).catch(() => reject(err)), 500);
        }),
    );
}
