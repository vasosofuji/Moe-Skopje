import { z } from "zod";
import { fetchJson } from "./fetch-json";
import { loadSeed } from "./seed";
import type { Adapter, Feature } from "./types";

const URL_ =
  "https://api.open-meteo.com/v1/forecast?latitude=41.9981&longitude=21.4254" +
  "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
  "&hourly=temperature_2m,precipitation_probability&timezone=Europe%2FSkopje&forecast_days=1";

const Forecast = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
  hourly: z.object({ temperature_2m: z.array(z.number().nullable()), precipitation_probability: z.array(z.number().nullable()) }),
});

/** Pure: Open-Meteo forecast → one point at the city centre. `detail.hourly` / `hourlyPrecip` are JSON strings of today's 24 hourly values. */
export function parseWeather(json: unknown): Feature[] {
  const { current: c, hourly } = Forecast.parse(json);
  return [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [21.4254, 41.9981] }, // Open-Meteo snaps to its own grid; the pin stays on the centre
      properties: {
        id: "weather-skopje",
        kind: "weather",
        title: { mk: "Време во Скопје", en: "Weather in Skopje" },
        value: c.temperature_2m,
        unit: "°C",
        detail: {
          temperature: c.temperature_2m,
          apparent: c.apparent_temperature,
          precipitation: c.precipitation,
          weatherCode: c.weather_code, // WMO code
          wind: c.wind_speed_10m, // km/h
          hourly: JSON.stringify(hourly.temperature_2m),
          hourlyPrecip: JSON.stringify(hourly.precipitation_probability), // %
        },
      },
    },
  ];
}

export const weather: Adapter = {
  id: "weather",
  ttl: 900,
  minFeatures: 1,
  source: { name: "Open-Meteo", url: "https://open-meteo.com" },
  async fetch(signal) {
    return parseWeather(await fetchJson(URL_, signal));
  },
  seed: () => loadSeed("weather"),
};
