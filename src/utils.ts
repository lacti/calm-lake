/**
 * Run a work at next tick with `setImmediate` callback
 * and return a result of this function via a result of `Promise`.
 *
 * @param actualWork The actual work to run in next tick.
 */
export const nextDo = <R>(actualWork: () => R | Promise<R>) =>
  new Promise<R>((resolve, reject) =>
    setImmediate(async () => {
      try {
        const resultOrPromise = actualWork();
        if (
          resultOrPromise !== undefined &&
          resultOrPromise instanceof Promise
        ) {
          resultOrPromise.then(resolve).catch(reject);
        } else {
          resolve(resultOrPromise);
        }
      } catch (error) {
        reject(error);
      }
    })
  );

/**
 * Simple logger to hide debugging logs easily.
 */
export const logger = {
  debug: (message?: any, ...optionalParams: any[]) => {
    if (!!process.env.SSP_DEBUG || process.env.DEBUG === "*") {
      // tslint:disable-next-line no-console
      console.debug(message, ...optionalParams);
    }
  },
  error: console.error, // tslint:disable-line no-console
  warn: console.warn // tslint:disable-line no-console
};
