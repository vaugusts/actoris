import {
  ConfigurationAdapter,
  DataAdapter,
  LogSink,
  ResultSink,
  SecretAdapter,
  UiDriver
} from "./contracts";

type Factory<T> = (options?: Record<string, unknown>) => T;

export class ModuleRegistry {
  private readonly configAdapters = new Map<string, Factory<ConfigurationAdapter>>();
  private readonly dataAdapters = new Map<string, Factory<DataAdapter>>();
  private readonly secretAdapters = new Map<string, Factory<SecretAdapter>>();
  private readonly resultSinks = new Map<string, Factory<ResultSink>>();
  private readonly logSinks = new Map<string, Factory<LogSink>>();
  private readonly drivers = new Map<string, Factory<UiDriver>>();

  registerConfig(name: string, factory: Factory<ConfigurationAdapter>): this {
    this.configAdapters.set(name, factory);
    return this;
  }

  registerData(name: string, factory: Factory<DataAdapter>): this {
    this.dataAdapters.set(name, factory);
    return this;
  }

  registerSecrets(name: string, factory: Factory<SecretAdapter>): this {
    this.secretAdapters.set(name, factory);
    return this;
  }

  registerResultSink(name: string, factory: Factory<ResultSink>): this {
    this.resultSinks.set(name, factory);
    return this;
  }

  registerLogSink(name: string, factory: Factory<LogSink>): this {
    this.logSinks.set(name, factory);
    return this;
  }

  registerDriver(name: string, factory: Factory<UiDriver>): this {
    this.drivers.set(name, factory);
    return this;
  }

  createConfig(name: string, options?: Record<string, unknown>): ConfigurationAdapter {
    return this.instantiate("config adapter", name, this.configAdapters, options);
  }

  createData(name: string, options?: Record<string, unknown>): DataAdapter {
    return this.instantiate("data adapter", name, this.dataAdapters, options);
  }

  createSecrets(name: string, options?: Record<string, unknown>): SecretAdapter {
    return this.instantiate("secret adapter", name, this.secretAdapters, options);
  }

  createResultSink(name: string, options?: Record<string, unknown>): ResultSink {
    return this.instantiate("result sink", name, this.resultSinks, options);
  }

  createLogSink(name: string, options?: Record<string, unknown>): LogSink {
    return this.instantiate("log sink", name, this.logSinks, options);
  }

  createDriver(name: string, options?: Record<string, unknown>): UiDriver {
    return this.instantiate("driver", name, this.drivers, options);
  }

  private instantiate<T>(
    kind: string,
    name: string,
    store: Map<string, Factory<T>>,
    options?: Record<string, unknown>
  ): T {
    const factory = store.get(name);
    if (!factory) {
      throw new Error(`Unknown ${kind}: ${name}`);
    }

    return factory(options);
  }
}
