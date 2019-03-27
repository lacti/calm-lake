import { DataCallback, ErrorCallback } from "./callback";

/**
 * A stream proxy controller to manage a stream proxy as stable.
 * There are many exceptional cases while sending a data via stream proxy,
 * so this controller would create and manage a new proxy if an old one is broken.
 */
export interface StreamProxyController {
  /**
   * From the many situation, for example, an error occurred or manually requested,
   * it should prepare a new next stream proxy object to use it instead of the old one.
   *
   * In most cases, this method is called from `Controller` automatically to retry
   * to send a data when some error occurred, but there can be a case that call this method
   * manually to use a new stream.
   */
  goNextProxy: () => Promise<void>;
}

/**
 * A factory to create a `StreamProxy` from a `StreamProxyController`.
 *
 * @template T A type of data to send.
 * @template R A type of data to receive.
 */
export interface StreamProxyFactory<T, R> {
  /**
   * A constructor to create a new stream proxy object.
   * It can pass a `controller` object to a stream proxy object because
   * it can request to go a next proxy object manually in some circumstances.
   */
  newProxy: (controller: StreamProxyController) => Promise<StreamProxy<T, R>>;
}

/**
 * A stream proxy that can send a data or receive a data from the opposite side.
 * It can be destroyable to cleanup its resource and throwable an error to
 * retry sending process from `StreamProxyController`.
 *
 * @template T A type of data to send.
 * @template R A type of data to receive.
 */
export interface StreamProxy<T, R> {
  /**
   * Send a data to the actual stream.
   */
  send: (data: T) => void;

  /**
   * Destroy any resources related the actual stream.
   */
  destroy: () => void;

  /**
   * If there is a data from the opposite of actual stream,
   * it can be passed back to the stable side.
   */
  onData: (callback: DataCallback<R>) => void;

  /**
   * If there is an error occured from the actual stream,
   * it can be passed back to the controller side to manage a stream proxy as stable.
   */
  onError: (callback: ErrorCallback) => void;
}
