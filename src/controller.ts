import { EventBroker } from "./event";
import {
  StreamProxy,
  StreamProxyConstructor,
  StreamProxyController
} from "./stream";
import { logger, postCall } from "./utils";

/**
 * An event map for `Controller`.
 */
interface ControllerEventMap<R> {
  data: R;
  ready: void;
  error: Error;
}

/**
 * A controller to manage a stream proxy safely,
 * and renew that if something is wrong, for example, an exception occurred while sending a data.
 */
export default class Controller<T, R> extends EventBroker<ControllerEventMap<R>>
  implements StreamProxyController {
  /**
   * A state of that it can send a data via a stream proxy or not.
   */
  public get ready() {
    return this.running && this.proxy != null;
  }

  /**
   * A reference of actual stream proxy that can be replaced using `goNextProxy` method.
   * So it is nullable.
   */
  private proxy: StreamProxy<T, R> | null = null;

  /**
   * It would be false when it calls `destroy` method.
   * After that, all operations would be ignored.
   */
  private running: boolean = true;

  /**
   * It would be true while processing of `goNextProxy`.
   * Because of this, it can coalesce many of `goNextProxy` calls.
   */
  private goingToNextProxy: boolean = false;

  /**
   * Create a new controller to make a stream proxy to be stable.
   *
   * @param proxyConstructor A constructor to create a stream proxy.
   */
  constructor(private readonly proxyConstructor: StreamProxyConstructor<T, R>) {
    super();
  }

  /**
   * Try to create a new stream proxy  and call a `onReady` callback after that.
   * It will execute an actual work at next tick because it uses `postCall` function.
   *
   * Note:
   * A constructor is asynchronous function so it should be careful
   * about overlapped execution to avoid a concurrency issue.
   */
  public goNextProxy = () =>
    postCall(async () => {
      if (!this.running) {
        logger.debug(
          `[SSP][Controller]`,
          `Cannot go a next proxy because it is halted.`
        );
        return;
      }
      if (this.goingToNextProxy) {
        logger.debug(
          `[SSP][Controller]`,
          `There is an another going process for a next proxy.`
        );
        return;
      }
      this.goingToNextProxy = true;
      try {
        this.destroyCurrentProxy();
        logger.debug(
          `[SSP][Controller]`,
          `Try to create a new stream proxy by a constructor.`
        );
        this.proxy = await this.proxyConstructor(this);
        logger.debug(
          `[SSP][Controller]`,
          `A new stream proxy is created by a constructor.`
        );

        if (!this.running) {
          logger.debug(
            `[SSP][Controller]`,
            `Destroy a new stream proxy because it is halted.`
          );
          this.destroyCurrentProxy();
          return;
        }
        this.proxy.on("error", this.onProxyError);
        this.proxy.on("data", data => this.fire("data", data));

        // Fire "onReady" handler and forget.
        logger.debug(
          `[SSP][Controller]`,
          `Post a "onReady" signal to the outside.`
        );
        postCall(() => {
          this.fire("ready", undefined);
        });
      } catch (error) {
        this.onError(error);

        // If something is wrong, try to create a new stream object in next tick.
        this.goNextProxy();
      } finally {
        this.goingToNextProxy = false;
      }
    });

  /**
   * Send a data into a stream proxy with below process.
   *
   * 1. Send a data into `this.proxy` object if it exists.
   * 2. If failed to send, retry with `goNextProxy` in `onProxyError` method.
   * 3. If there is no stream proxy, create a new one via `goNextProxy` method.
   */
  public send = (data: T) => {
    if (!this.running) {
      logger.debug(
        `[SSP][Controller]`,
        `Cannot send a data because it is halted.`
      );
      return false;
    }
    if (this.proxy != null) {
      try {
        this.proxy.send(data);
        return true;
      } catch (error) {
        // Yes, it can be failed so we should retry this process.
        this.onProxyError(error);
        return false;
      }
    } else {
      logger.debug(
        `[SSP][Controller]`,
        `Go a next proxy because there is no stream proxy.`
      );
      this.goNextProxy();
      // It can be re-tried from "onReady" callback.
    }
    return false;
  };

  /**
   * Set `this.running` to false so all operation can be rejected after this.
   * And destroy current `this.proxy` object.
   */
  public destroy = () => {
    this.running = false;
    this.destroyCurrentProxy();
  };

  /**
   * Call `this.proxy.destroy()` if it exists.
   * And ignore an error while destroying this proxy object.
   */
  private destroyCurrentProxy = () => {
    if (this.proxy === null) {
      return;
    }
    const oldProxy = this.proxy;
    // This variable should be null as soon as possible
    // because it can be used at "send" method when there can be a promise in below process.
    this.proxy = null;
    try {
      logger.debug(`[SSP][Controller]`, `Destroy the old proxy object.`);
      if (oldProxy.destroy) {
        oldProxy.destroy();
      }
    } catch (error) {
      this.onError(error);
    }
  };

  /**
   * Report an error object to `this.maybeOnError` callback
   * or `logger.warn` if there is no callback.
   */
  private onError = (error: Error) => {
    if (this.fire("error", error)) {
      logger.debug(
        `[SSP][Controller]`,
        `Propergate an error to the outside.`,
        error
      );
    } else {
      logger.warn(`[SSP][Controller] Error`, error);
    }
  };

  /**
   * Call `goNextProxy` and report an error.
   */
  private onProxyError = (error: Error) => {
    // First, try to acquire a new stream proxy for next works.
    this.goNextProxy();

    // And then report this error.
    this.onError(error);
  };
}
