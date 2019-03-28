import { BasicStreamProxy, calm, StreamProxyController } from "../src";
import { logger } from "../src/utils";

// process.env.SSP_DEBUG = "1";

class NumberToStringStream extends BasicStreamProxy<number, string> {
  private static streamSerial: number = 0;

  constructor(
    private readonly controller: StreamProxyController,
    private readonly serial: number = ++NumberToStringStream.streamSerial // Only for debugging purpose.
  ) {
    super();
  }

  public send = (data: number) => {
    // Inovke going a next proxy manually.
    if (data % 2 === 0) {
      logger.debug(
        `Stream[${this.serial}] Data(${data}) Request to a next proxy.`
      );
      this.controller.goNextProxy();
    }
    logger.debug(`Stream[${this.serial}] Process(${data})`);

    // Maybe, an error can be occurred while processing something.
    if (Math.random() < 0.2) {
      throw new Error("What?");
    }

    // Fire a processed data or an error.
    try {
      this.fire("data", data.toString());
    } catch (error) {
      this.fire("error", error);
      this.controller.goNextProxy();
    }
  };
  public destroy = () => {
    logger.debug(`Stream[${this.serial}] Destroyed.`);
  };
}

const sleep = (millis: number) =>
  new Promise<void>(resolve => setTimeout(resolve, millis));

test("basic", async () => {
  // Initialize lake with a constructor of a stream proxy.
  let result = 0;
  const lake = calm(async controller => {
    logger.debug(`Create a new stream proxy.`);
    return new NumberToStringStream(controller);
  }).on("data", data => (result += +data));

  // Send all data into a lake.
  const n = 100;
  for (let i = 1; i <= n; ++i) {
    logger.debug(`Push Data(${i})`);
    lake.send(i);
    await sleep(1);
  }
  // Wait until all data in the buffer is flushed.
  while (!lake.empty) {
    await sleep(1);
  }
  // All data should be passed into the opposite of a stream proxy.
  expect(result).toBe((n * (n + 1)) / 2);
});
