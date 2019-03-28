# Calm Lake

> I want to use a stable stream but there are so many unexpected situations.

## Rationale

In mobile, a stream can be broken in many reasons such as changing network AP, signal weakness or a failure from the back-end. If a stream is stable, of course it can be not perfect, I think it will be very useful because we can delete many exception-catch codes.

## Examples

### Google Speech-to-text Streaming

```typescript
// First, create a stream proxy with Google Speech-to-text stream.
class GoogleStreamProxy extends BasicStreamProxy<Buffer, SpeechEvent> {
  constructor(
    controller: StreamProxyController,
    private readonly recognizeStream: NodeJS.WritableStream,
  ) {
    super();
    this.recognizeStream
      .on('error', error => this.fire('error', error))
      .on('data', data => {
        this.fire('data', data);
        // https://github.com/vin-ni/Google-Cloud-Speech-Node-Socket-Playground/issues/9
        if (/* is end of utterance */) {
          controller.goNextProxy();
        }
      });
  }

  public send = (data: Buffer) => {
    this.recognzeStream.write(data);
  }

  public destroy = () => {
    this.recognizeStream.end();
  }
}

// Make a lake to be calm.
const lake = calm(async controller => new GoogleStreamProxy(
  controller,
  googleSpeechClient.streamingRecognize(/*request*/)),
)
  .on('data', console.info)
  .on('error', console.warn);

// Send a data into a lake.
lake.send(audioBuffer);
```

## License

MIT
