// tslint:disable max-classes-per-file no-console

import StableStreamProxy, {
  DataCallback,
  ErrorCallback,
  StreamProxy,
  StreamProxyController
} from "../src";

process.env.SSP_DEBUG = "1";

let streamSerial = 0;
class NumberToStringStream implements StreamProxy<number, string> {
  private dataCallback: DataCallback<string>;
  private errorCallback: ErrorCallback;
  constructor(
    private readonly controller: StreamProxyController,
    private readonly serial: number = ++streamSerial
  ) {}

  public send = (data: number) => {
    if (data % 2 === 0) {
      console.log(
        `Stream[${this.serial}] Data(${data}) Request to a next proxy.`
      );
      this.controller.goNextProxy();
    }
    console.log(`Stream[${this.serial}] Process(${data})`);
    if (Math.random() < 0.3) {
      throw new Error("What?");
    }
    try {
      if (this.dataCallback) {
        this.dataCallback((-data).toString());
      }
    } catch (error) {
      if (this.errorCallback) {
        this.errorCallback(error);
      }
      this.controller.goNextProxy();
    }
  };
  public destroy = () => {
    // do nothing
    console.log(`Stream[${this.serial}] Destroyed.`);
  };

  public onData = (callback: DataCallback<string>) =>
    (this.dataCallback = callback);
  public onError = (callback: ErrorCallback) => (this.errorCallback = callback);
}

const newProxy = async (controller: StreamProxyController) => {
  console.log(`Factory CreateNew stream`);
  return new NumberToStringStream(controller);
};

const sleep = (millis: number) =>
  new Promise<void>(resolve => setTimeout(resolve, millis));

test("basic", async () => {
  const stable = new StableStreamProxy(newProxy, data => {
    console.log(data);
  });
  for (let i = 0; i < 10; ++i) {
    console.log(`Push Data(${i})`);
    stable.send(i);
    await sleep(100);
  }
});
