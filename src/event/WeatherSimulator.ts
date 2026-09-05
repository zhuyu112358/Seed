import type { WorldSystem } from "../engine/World.js";
import type { EventSystem } from "../event/EventSystem.js";
import type { World } from "../engine/World.js";
import type { WeatherState } from "../types/index.js";

/** Environmental weather data snapshot. */
export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: { x: number; y: number; z: number };
  pressure: number;
  state: WeatherState;
  lightLevel: number;
}

/** Configuration for weather simulation. */
export interface WeatherConfig {
  initialTemperature?: number;
  initialHumidity?: number;
  initialWindSpeed?: number;
  initialState?: WeatherState;
  temperatureAmplitude?: number;
  humidityDrift?: number;
  windVolatility?: number;
}

const DEFAULT_CONFIG: Required<WeatherConfig> = {
  initialTemperature: 20,
  initialHumidity: 50,
  initialWindSpeed: 2,
  initialState: "clear",
  temperatureAmplitude: 8,
  humidityDrift: 0.5,
  windVolatility: 0.3,
};

/**
 * Simulates dynamic weather conditions: temperature, humidity, wind,
 * and weather state transitions. Drives world event triggering.
 */
export class WeatherSimulator implements WorldSystem {
  readonly name = "weather";
  enabled = true;

  private data: WeatherData;
  private readonly config: Required<WeatherConfig>;
  private targetTemperature: number;

  constructor(config?: WeatherConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.data = {
      temperature: Math.max(-40, Math.min(50, this.config.initialTemperature)),
      humidity: Math.max(0, Math.min(100, this.config.initialHumidity)),
      windSpeed: Math.max(0, Math.min(60, this.config.initialWindSpeed)),
      windDirection: { x: 1, y: 0, z: 0 },
      pressure: 1013,
      state: this.config.initialState,
      lightLevel: 0.8,
    };
    this.targetTemperature = this.config.initialTemperature;
  }

  getWeather(): Readonly<WeatherData> { return this.data; }
  get temperature(): number { return this.data.temperature; }
  get humidity(): number { return this.data.humidity; }
  get windSpeed(): number { return this.data.windSpeed; }
  get state(): WeatherState { return this.data.state; }

  setTargetTemperature(temp: number): void { this.targetTemperature = Math.max(-40, Math.min(50, temp)); }
  setWeatherState(state: WeatherState): void { this.data.state = state; }

  tick(dt: number, world: World, _events: EventSystem): void {
    // Temperature drifts toward target with day-night cycle influence
    const dayFactor = world.worldTime > 0 ? Math.sin((world.worldTime % 120) / 120 * Math.PI) : 0;
    const target = this.targetTemperature + dayFactor * this.config.temperatureAmplitude * 0.3;
    this.data.temperature += (target - this.data.temperature) * 0.01 * dt * 60;

    // Humidity random walk
    this.data.humidity += (Math.random() - 0.5) * this.config.humidityDrift * dt * 60;
    this.data.humidity = Math.max(0, Math.min(100, this.data.humidity));

    // Wind speed random walk with mean reversion
    const meanWind = 3;
    this.data.windSpeed += (Math.random() - 0.5) * this.config.windVolatility * dt * 60;
    this.data.windSpeed += (meanWind - this.data.windSpeed) * 0.005 * dt * 60;
    this.data.windSpeed = Math.max(0, Math.min(60, this.data.windSpeed));

    // Wind direction slowly rotates
    const angle = dt * 0.05;
    const { x, z } = this.data.windDirection;
    this.data.windDirection.x = x * Math.cos(angle) - z * Math.sin(angle);
    this.data.windDirection.z = x * Math.sin(angle) + z * Math.cos(angle);

    // Pressure drift
    this.data.pressure += (Math.random() - 0.5) * 0.1 * dt * 60;
    this.data.pressure = Math.max(980, Math.min(1040, this.data.pressure));

    // Weather state transition based on conditions
    this.updateWeatherState(dt);
  }

  private updateWeatherState(dt: number): void {
    const { humidity, windSpeed, pressure } = this.data;
    const transitionProb = 0.001 * dt * 60;

    if (Math.random() > transitionProb) return;

    // High humidity + low pressure -> rain/storm
    if (humidity > 70 && pressure < 1005) {
      this.data.state = windSpeed > 15 ? "storm" : "rain";
      return;
    }
    // High wind -> windy
    if (windSpeed > 12) {
      this.data.state = "windy";
      return;
    }
    // Moderate humidity -> cloudy
    if (humidity > 55) {
      this.data.state = "cloudy";
      return;
    }
    // Low humidity + normal pressure -> clear
    if (humidity < 40 && pressure > 1010) {
      this.data.state = "clear";
      return;
    }
    // Cold temperature -> snow/fog
    if (this.data.temperature < 0) {
      this.data.state = humidity > 60 ? "snow" : "fog";
    }
  }

  start(): void { /* no-op */ }
  stop(): void { /* no-op */ }
}