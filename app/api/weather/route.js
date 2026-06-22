const DEFAULT_COORDS = {
  lat: 33.4996,
  lon: 126.5312,
  label: "제주시",
};

const weatherCodeLabels = {
  0: "맑음",
  1: "대체로 맑음",
  2: "구름 조금",
  3: "흐림",
  45: "안개",
  48: "안개",
  51: "이슬비",
  53: "이슬비",
  55: "이슬비",
  61: "비",
  63: "비",
  65: "강한 비",
  71: "눈",
  73: "눈",
  75: "강한 눈",
  80: "소나기",
  81: "소나기",
  82: "강한 소나기",
  95: "뇌우",
  96: "뇌우",
  99: "뇌우",
};

function getWeatherCondition(code) {
  return weatherCodeLabels[code] || "흐림";
}

function numberOrFallback(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function formatKoreanHour(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    hour12: true,
  }).format(date);
}

function formatKoreanDay(value, index) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return ["일", "월", "화", "수", "목", "금", "토"][index % 7];
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date).replace("요일", "");
}

async function fetchLocationName(lat, lon) {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=ko&format=json`,
      { next: { revalidate: 60 * 60 } },
    );
    if (!response.ok) throw new Error("Reverse geocoding failed");
    const data = await response.json();
    const place = data?.results?.[0];
    return [place?.admin1, place?.admin2, place?.name].filter(Boolean).join(" ") || "";
  } catch {
    return "";
  }
}

function buildWeatherPayload(data, location, latitude, longitude) {
  const current = data.current || {};
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const currentTemp = numberOrFallback(current.temperature_2m);
  const todayHigh = numberOrFallback(daily.temperature_2m_max?.[0], currentTemp);
  const todayLow = numberOrFallback(daily.temperature_2m_min?.[0], currentTemp);

  const hourlyItems = (hourly.time || []).slice(0, 24);
  const step = Math.max(Math.floor(hourlyItems.length / 8), 1);
  const sampledHours = hourlyItems.filter((_, index) => index % step === 0).slice(0, 8);

  return {
    location,
    coordinates: { lat: latitude, lon: longitude },
    current: {
      temp: currentTemp,
      condition: getWeatherCondition(current.weather_code),
      precipitation: numberOrFallback(hourly.precipitation_probability?.[0] ?? daily.precipitation_probability_max?.[0]),
      humidity: numberOrFallback(current.relative_humidity_2m),
      wind: numberOrFallback(current.wind_speed_10m),
      high: todayHigh,
      low: todayLow,
    },
    hourly: sampledHours.map((time) => {
      const index = hourly.time.indexOf(time);
      return {
        time: formatKoreanHour(time),
        temp: numberOrFallback(hourly.temperature_2m?.[index]),
        rain: numberOrFallback(hourly.precipitation_probability?.[index]),
        wind: numberOrFallback(hourly.wind_speed_10m?.[index]),
      };
    }),
    weekly: (daily.time || []).slice(0, 8).map((date, index) => ({
      day: formatKoreanDay(date, index),
      condition: getWeatherCondition(daily.weather_code?.[index]),
      high: numberOrFallback(daily.temperature_2m_max?.[index]),
      low: numberOrFallback(daily.temperature_2m_min?.[index]),
      rain: numberOrFallback(daily.precipitation_probability_max?.[index]),
      today: index === 0,
    })),
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const latitude = Number.isFinite(lat) ? lat : DEFAULT_COORDS.lat;
    const longitude = Number.isFinite(lon) ? lon : DEFAULT_COORDS.lon;

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(latitude));
    forecastUrl.searchParams.set("longitude", String(longitude));
    forecastUrl.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m");
    forecastUrl.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m");
    forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("forecast_days", "8");

    const response = await fetch(forecastUrl, { next: { revalidate: 10 * 60 } });
    if (!response.ok) {
      return Response.json({ error: "WEATHER_API_FAILED", message: "날씨 정보를 불러오지 못했습니다." }, { status: 502 });
    }

    const data = await response.json();
    const locationName = await fetchLocationName(latitude, longitude);
    const fallbackLocation = latitude === DEFAULT_COORDS.lat && longitude === DEFAULT_COORDS.lon ? DEFAULT_COORDS.label : "현재 위치";

    return Response.json({
      weather: buildWeatherPayload(data, locationName || fallbackLocation, latitude, longitude),
      source: "open-meteo",
    });
  } catch (error) {
    console.error("Weather API route failed:", {
      message: error?.message,
    });
    return Response.json({ error: "WEATHER_API_FAILED", message: "날씨 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
