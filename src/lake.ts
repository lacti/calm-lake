import { DataCallback, ErrorCallback } from "./callback";
import Controller from "./controller";
import { StreamProxyConstructor } from "./stream";
import { logger } from "./utils";

/**
 * TBU
 */
export default class CalmLake<T, R> {
  private readonly controller: Controller<T, R>;
  private initial: boolean = true;
  private running: boolean = true;
  private buffer: T[] = [];

  /**
   * TBU
   *
   * @param proxyConstructor
   * @param dataCallback
   * @param errorCallback
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

  public send = (data: T) => {
    if (!this.running) {
      return false;
    }
    this.buffer.push(data);
    if (this.initial || this.controller.ready) {
      logger.debug(`[SSP][Proxy]`, `Try to lazy connect.`);
      this.initial = false;
      this.flush();
    }
    return true;
  };

  public destroy = () => {
    this.running = false;
    this.buffer = [];
    this.controller.destroy();
  };

  private flush = () => {
    if (!this.running) {
      logger.debug(`[SSP][Proxy]`, `Cannot flush because a proxy is halted.`);
      return false;
    }
    while (this.buffer.length > 0) {
      const oldOne = this.buffer[0];
      if (!this.controller.send(oldOne)) {
        logger.debug(`[SSP][Proxy]`, `Cannot send a data via controller.`);
        break;
      }
      this.buffer.shift();
      logger.debug(`[SSP][Proxy]`, `Shift old data from the buffer.`);
    }
    // normal or abnormal
  };

  private onReady = () => {
    if (!this.running) {
      logger.debug(
        `[SSP][Proxy]`,
        `Cannot be ready because a proxy is halted.`
      );
      return false;
    }
    logger.debug(`[SSP][Proxy]`, `Shift old data from the buffer.`);
    this.flush();
  };
}
