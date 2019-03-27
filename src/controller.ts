import { DataCallback, ErrorCallback, VoidCallback } from "./callback";
import {
  StreamProxy,
  StreamProxyController,
  StreamProxyFactory
} from "./stream";
import { logger, nextDo as doNextTurn } from "./utils";

/**
 * A controller to manage a stream proxy object safely,
 * and renew that if something is wrong, for example, an exception occurred while sending a data.
 */
export default class Controller<T, R> implements StreamProxyController {
  public get ready() {
    return this.running && this.proxy != null;
  }
  private proxy: StreamProxy<T, R> | null = null;
  private running: boolean = true;
  private goingToNextProxy: boolean = false;

  constructor(
    private readonly factory: StreamProxyFactory<T, R>,
    private readonly onData: DataCallback<R>,
    private readonly onReady: VoidCallback,
    private readonly maybeOnError?: ErrorCallback
  ) {}

  /**
   * Try to create a new stream proxy object  and call a `onReady` callback after that.
   * It will execute an actual work at next tick because it uses `doNextTurn` function.
   *
   * Note:
   * A factory method is asynchronous function so it should be careful
   * about overlapped execution to avoid a concurrency issue.
   */
  public goNextProxy = () =>
    doNextTurn(async () => {
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
          `Try to create a new stream proxy object by a factory.`
        );
        this.proxy = await this.factory.newProxy(this);
        logger.debug(
          `[SSP][Controller]`,
          `A new stream proxy object is created by a factory.`
        );

        if (!this.running) {
          logger.debug(
            `[SSP][Controller]`,
            `Destroy a new stream proxy object because it is halted.`
          );
          this.destroyCurrentProxy();
          return;
        }
        this.proxy.onError(this.onProxyError);
        this.proxy.onData(this.onData);

        // Fire "onReady" handler and forget.
        logger.debug(
          `[SSP][Controller]`,
          `Post a "onReady" signal to the outside.`
        );
        doNextTurn(this.onReady);
      } catch (error) {
        this.onError(error);

        // If something is wrong, try to create a new stream object in next tick.
        this.goNextProxy();
      } finally {
        this.goingToNextProxy = false;
      }
    });

  /**
   * Send a data into a stream proxy object with below process.
   *
   * 1. Send a data into `this.proxy` object if it exists.
   * 2. If failed to send, retry with `goNextProxy` in `onProxyError` method.
   * 3. If there is no stream proxy object, create a new one via `goNextProxy` method.
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
      oldProxy.destroy();
    } catch (error) {
      this.onError(error);
    }
  };

  /**
   * Report an error object to `this.maybeOnError` callback
   * or `logger.warn` if there is no callback.
   */
  private onError = (error: Error) => {
    if (this.maybeOnError) {
      logger.debug(
        `[SSP][Controller]`,
        `Propergate an error to the outside.`,
        error
      );
      this.maybeOnError(error);
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
