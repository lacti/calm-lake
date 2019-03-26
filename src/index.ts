import { Writable } from "stream";

class Facade {}

class Port<T, R> {
  private buffer: T[] = [];

  constructor(private readonly controller: ShipController<T, R>) {}

  public send = (data: T) => {
    this.buffer.push(data);
    if (this.controller.ready) {
      this.flush();
    }
  };

  public onReady = () => {
    this.flush();
  };

  private flush = () => {
    while (this.buffer.length > 0) {
      const oldOne = this.buffer[0];
      if (!this.controller.send(oldOne)) {
        break;
      }
      this.buffer.shift();
    }
    // normal or abnormal
  };
}

class ShipController<T, R> {
  private ship: Ship<T, R> | null = null;

  constructor(
    private readonly factory: ShipFactory<T, R>,
    private readonly onReady?: () => void
  ) {}

  public newShip = async () => {
    if (this.ship !== null) {
      try {
        this.ship.destroy();
      } catch (error) {
        // just report
      }
      this.ship = null;
    }
    this.ship = await this.factory.newShip(this);
    // ready
    if (this.onReady) {
      this.onReady();
    }
  };

  public onError = () => {
    // report error
    this.newShip();
    // ship error <-
    /// this.ship = ??
  };

  public get ready() {
    return this.ship != null;
  }

  public send = (data: T) => {
    if (this.ship != null) {
      try {
        this.ship.load(data);
        return true;
      } catch (error) {
        // TODO report error
        return false;
      }
    } else {
      // future: onReady -> flush
      this.newShip();
    }
    return false;
  };
}

interface ShipFactory<T, R> {
  newShip: (controller: ShipController<T, R>) => Promise<Ship<T, R>>;
}

interface Ship<T, R> {
  load: (data: T) => void;
  unload: (callback: (money: R) => void) => void;
  destroy: () => void;
}

enum State {
  Idle,
  Ok,
  Retry
}

interface StreamFactory {
  renew: () => Writable;
}

export default class ResumeableStream<T> {
  private readonly buffer: T[] = [];

  private state: State = State.Idle;
  private stream: Writable | null = null;

  constructor(
    private readonly factory: StreamFactory,
    private readonly maxBufferSize: number = 65536
  ) {}

  public write = (data: T) => {
    this.buffer.push(data);
    if (this.buffer.length > this.maxBufferSize) {
      throw new Error("BufferOverflow");
    }
    this.flushBuffer();
  };

  private flushBuffer = () => {
    if (this.buffer.length === 0) {
      return;
    }
    if (this.stream === null) {
      this.retryToRenewStream();
    }
    if (this.stream !== null) {
      while (this.buffer.length > 0) {
        try {
          const data = this.buffer[0];
          this.stream.write(data);
          this.buffer.shift();
        } catch (error) {
          this.resetStream(error);
        }
      }
    }
  };

  private retryToRenewStream = () => {
    this.state = State.Retry;
    try {
      this.stream = this.factory.renew();
      this.stream.on("error", this.resetStream);
      return true;
    } catch (error) {
      this.resetStream(error);
    }
    // FIXME Retry policy
    return false;
  };

  private resetStream = (error: Error) => {
    // FIXME retry
    this.state = State.Retry;
    console.error(error);
    this.clearStream();
  };

  private clearStream = () => {
    // FIXME clear stream context
    this.stream = null;
  };
}
