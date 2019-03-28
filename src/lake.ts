import { DataCallback, ErrorCallback } from "./callback";
import Controller from "./controller";
import { StreamProxyConstructor } from "./stream";
import { logger } from "./utils";

/**
 * A simple helper for do these.
 *
 * 1. Manage a stream proxy when it is broken.
 * 2. Keep data into the buffer and resend them.
 */
export default class CalmLake<T, R> {
  private readonly controller: Controller<T, R>;

  /**
   * To connect with a stream proxy lazily, it checks if it is a first time to request.
   */
  private initial: boolean = true;

  /**
   * It would be false when it calls `destroy` method.
   * After that, all operations would be ignored.
   */
  private running: boolean = true;

  /**
   * A buffer to store data which cannot be sent because a stream is broken.
   * It will be sent after recovering it.
   */
  private buffer: T[] = [];

  /**
   * Create a new `CalmLake` with a constructor of a stream proxy.
   *
   * @param proxyConstructor A constructor to create a new stream proxy.
   * @param dataCallback A callback to retrieve a data from the opposite of a stream proxy.
   * @param errorCallback A callback to retrieve an error from this system.
   */
  constructor(
    proxyConstructor: StreamProxyConstructor<T, R>,
    dataCallback: DataCallback<R>,
    errorCallback?: ErrorCallback
  ) {
    this.controller = new Controller<T, R>(
      proxyConstructor,
      dataCallback,
      this.onReady,
      errorCallback
    );
  }

  /**
   * Try to send a data via a stream proxy, first.
   * If can't, keep it into the buffer and retry later at `flush` method.
   */
  public send = (data: T) => {
    if (!this.running) {
      return false;
    }
    this.buffer.push(data);

    // It should check `initial` to delay to first connect until it is needed.
    if (this.initial) {
      logger.debug(`[SSP][Lake]`, `Try to lazy connect.`);
      this.initial = false;
      this.flush();
    }
    // If a controller is not ready, it means `onReady` is called after connected.
    else if (this.controller.ready) {
      this.flush();
    }
    // Anyway, it send this data now or later.
    return true;
  };

  /**
   * Set `this.running` to false so all operation can be rejected after this.
   * And call `this.controller.destroy` method.
   */
  public destroy = () => {
    this.running = false;
    this.buffer = [];
    this.controller.destroy();
  };

  /**
   * Try to flush all data in the buffer with a controller.
   * If a controller is not ready due to some errors, it will give up now
   * but it will send them after calling `onReady` function from a controller.
   */
  private flush = () => {
    if (!this.running) {
      logger.debug(`[SSP][Lake]`, `Cannot flush because it is halted.`);
      return false;
    }
    while (this.buffer.length > 0) {
      const oldOne = this.buffer[0];
      // If it cannot send a data, try it later.
      if (!this.controller.send(oldOne)) {
        logger.debug(`[SSP][Lake]`, `Cannot send a data via controller.`);
        break;
      }
      this.buffer.shift();
      logger.debug(`[SSP][Lake]`, `Shift old data from the buffer.`);
    }
    // In this time, a buffer can have some data cannot be sent.
    // But it will send them after calling `onReady` function from a controller.
  };

  /**
   * This is a callback to retrieve the ready signal from a controller when
   * a stream proxy is ready to send a data.
   *
   * It means a stream proxy is connected in first time or recovered from a failure
   * so it can send data from the buffer to this stream proxy now.
   */
  private onReady = () => {
    if (!this.running) {
      logger.debug(`[SSP][Lake]`, `Cannot be ready because it is halted.`);
      return false;
    }
    logger.debug(`[SSP][Lake]`, `Shift old data from the buffer.`);
    this.flush();
  };
}
