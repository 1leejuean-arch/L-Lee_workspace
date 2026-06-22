import { getMockWeather } from "../../../lib/weatherData";

export async function GET() {
  return Response.json({ weather: getMockWeather(), source: "mock" });
}
