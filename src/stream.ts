import { EventBroker, EventListenable } from "./event";

/**
 * A stream proxy controller to manage a stream proxy as stable.
 * There are many exceptional cases while sending a data via stream proxy,
 * so this controller would create and manage a new proxy if an old one is broken.
 */
export interface StreamProxyController {
  /**
   * From the many situation, for example, an error occurred or manually requested,
   * it should prepare a new next stream proxy to use it instead of the old one.
   *
   * In most cases, this method is called from `Controller` automatically to retry
   * to send a data when some error occurred, but there can be a case that call this method
   * manually to use a new stream.
   */
  goNextProxy: () => Promise<void>;
}

/**
 * A constructor to create a `StreamProxy` from a `StreamProxyController`.
 *
 * @template T A type of data to send.
 * @template R A type of data to receive.
 */
export type StreamProxyConstructor<T, R> = (
  controller: StreamProxyController
) => Promise<StreamProxy<T, R>>;

/**
 * An event map for a stream proxy.
 *
 * @template R A type of data to receive.
 */
export interface StreamProxyEvent<R> {
  data: R;
  error: Error;
}

/**
 * A stream proxy that can send a data or receive a data from the opposite side.
 * It can be destroyable to cleanup its resource and throwable an error to
 * retry sending process from `StreamProxyController`.
 *
 * @template T A type of data to send.
 * @template R A type of data to receive.
 */
export interface StreamProxy<T, R>
  extends EventListenable<StreamProxyEvent<R>> {
  /**
   * Send a data to the actual stream.
   */
  send: (data: T) => void;

  /**
   * Destroy any resources related the actual stream.
   */
  destroy?: () => void;
}

/**
 * A simple base class to support a basic scaffolding of `StreamProxy<T, R>`
 * with `EventBroker` of `StreamProxyEvent<R>`.
 */
export abstract class BasicStreamProxy<T, R>
  extends EventBroker<StreamProxyEvent<R>>
  implements StreamProxy<T, R> {
  /**
   * Send a data to the actual stream.
   */
  public send: (data: T) => void;

  /**
   * Destroy any resources related the actual stream.
   */
  public destroy?: () => void;
}
