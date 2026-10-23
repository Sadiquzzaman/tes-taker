import axios from 'axios';

export type OutboundCall = { method: 'get' | 'post'; url: string; data?: unknown; config?: unknown };

/**
 * Blocks every outbound axios call (SMS, SSLCommerz, Google) so tests never reach a real
 * service. Calls are recorded and rejected unless a test installs a responder for that URL.
 */
export class OutboundHttp {
  readonly calls: OutboundCall[] = [];
  private readonly responders: Array<{ match: (call: OutboundCall) => boolean; respond: (call: OutboundCall) => unknown }> = [];

  install(): void {
    jest.spyOn(axios, 'post').mockImplementation(async (url: string, data?: unknown, config?: unknown) =>
      this.handle({ method: 'post', url, data, config }),
    );
    jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: unknown) =>
      this.handle({ method: 'get', url, config }),
    );
  }

  /** Answer calls whose URL contains `urlPart` with `{ status: 200, data: respond(call) }`. */
  respond(urlPart: string, respond: (call: OutboundCall) => unknown): void {
    this.responders.unshift({ match: (call) => call.url.includes(urlPart), respond });
  }

  reset(): void {
    this.calls.length = 0;
    this.responders.length = 0;
  }

  private async handle(call: OutboundCall) {
    this.calls.push(call);
    const responder = this.responders.find((r) => r.match(call));
    if (!responder) {
      throw new Error(`Outbound HTTP blocked in tests: ${call.method.toUpperCase()} ${call.url}`);
    }
    return { status: 200, data: responder.respond(call) };
  }
}
