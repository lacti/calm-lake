/**
 * A simple interface to listen an event specified an event map.
 */
export interface EventListenable<E> {
  /**
   * Listen an event with a handler.
   *
   * @param name An event name in this event map.
   * @param handler A handler to process an event specified this name.
   */
  on: <K extends keyof E>(name: K, handler: (event: E[K]) => void) => this;
}

/**
 * A simple event broker written by TypeScript.
 *
 * @example
 *
 * ```ts
 * interface MyEventMap {
 *  data: string;
 *  error: Error;
 * }
 * class MyClass extends EventEmitter<MyEventMap> {
 *   public doSomething = () => {
 *     this.fire('data', 'Hi, there!');
 *   }
 * }
 * ```
 *
 * @template E A type of event map.
 */
export class EventBroker<E> implements EventListenable<E> {
  /**
   * A map which contains pairs of handlers with their event key.
   */
  private readonly handlers: {
    [K in keyof E]?: Array<(event: E[K]) => void>
  } = {};

  /**
   * Listen an event with a handler.
   *
   * @param name An event name in this event map.
   * @param handler A handler to process an event specified this name.
   */
  public on = <K extends keyof E>(name: K, handler: (event: E[K]) => void) => {
    if (!this.handlers[name]) {
      this.handlers[name] = [];
    }
    this.handlers[name]!.push(handler);
    return this;
  };

  /**
   * Fire an event into handlers that listen that event.
   *
   * @param name An event name in this event map.
   * @param event An event to fire.
   */
  protected fire = <K extends keyof E>(name: K, event: E[K]) => {
    if (!this.handlers[name]) {
      return false;
    }
    for (const handler of this.handlers[name]!) {
      handler(event);
    }
    return true;
  };
}
