/**
 * A callback type to receive a data.
 */
export type DataCallback<R> = (data: R) => void;

/**
 * A callback type to do something without arguments.
 */
export type VoidCallback = () => void;

/**
 * A callback type to receive an error.
 */
export type ErrorCallback = (error: Error) => void;
