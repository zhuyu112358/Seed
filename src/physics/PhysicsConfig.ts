// Physics configuration. All numeric fields are in SI-like units (m, s, m/s^2).

export interface PhysicsConfigOptions {
  /** Gravity acceleration applied to dynamic bodies, in m/s^2 on the Y axis. */
  gravity?: number;
  /** Velocity damping per second, 0 = no friction, 1 = full stop in one second. */
  friction?: number;
  /** Air resistance coefficient applied against the velocity direction. */
  airResistance?: number;
  /** Fixed integration timestep in seconds used by the engine. */
  fixedDt?: number;
  /** Master switch for the whole physics subsystem. */
  enabled?: boolean;
  /** Bounce coefficient applied on collision (1 = perfectly elastic, 0 = sticky). */
  restitution?: number;
}

export class PhysicsConfig {
  public gravity: number;
  public friction: number;
  public airResistance: number;
  public fixedDt: number;
  public enabled: boolean;
  public restitution: number;

  constructor(opts: PhysicsConfigOptions = {}) {
    this.gravity = opts.gravity ?? 9.8;
    this.friction = opts.friction ?? 0.1;
    this.airResistance = opts.airResistance ?? 0.05;
    this.fixedDt = opts.fixedDt ?? 1 / 60;
    this.enabled = opts.enabled ?? true;
    this.restitution = opts.restitution ?? 0.6;
  }

  static defaults(): PhysicsConfig {
    return new PhysicsConfig();
  }

  /** Fluent builder used by the SDK. */
  static builder(): PhysicsConfigBuilder {
    return new PhysicsConfigBuilder();
  }
}

export class PhysicsConfigBuilder {
  private cfg: PhysicsConfigOptions = {};

  gravity(g: number): this {
    this.cfg.gravity = g;
    return this;
  }

  friction(f: number): this {
    this.cfg.friction = f;
    return this;
  }

  airResistance(a: number): this {
    this.cfg.airResistance = a;
    return this;
  }

  fixedDt(dt: number): this {
    this.cfg.fixedDt = dt;
    return this;
  }

  enabled(e: boolean): this {
    this.cfg.enabled = e;
    return this;
  }

  restitution(r: number): this {
    this.cfg.restitution = r;
    return this;
  }

  build(): PhysicsConfig {
    return new PhysicsConfig(this.cfg);
  }
}
