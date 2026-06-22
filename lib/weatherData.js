export const mockWeather = {
  location: "제주특별자치도 제주시 외도동",
  current: {
    temp: 21,
    condition: "비",
    precipitation: 90,
    humidity: 89,
    wind: 5,
    high: 23,
    low: 21,
  },
  hourly: [
    { time: "오후 11시", temp: 21, rain: 90, wind: 5 },
    { time: "오전 2시", temp: 22, rain: 80, wind: 4 },
    { time: "오전 5시", temp: 22, rain: 70, wind: 4 },
    { time: "오전 8시", temp: 23, rain: 55, wind: 5 },
    { time: "오전 11시", temp: 24, rain: 40, wind: 6 },
    { time: "오후 2시", temp: 25, rain: 35, wind: 7 },
    { time: "오후 5시", temp: 24, rain: 45, wind: 6 },
    { time: "오후 8시", temp: 22, rain: 65, wind: 5 },
  ],
  weekly: [
    { day: "월", condition: "비", high: 23, low: 21, rain: 90, today: true },
    { day: "화", condition: "비", high: 26, low: 21, rain: 70 },
    { day: "수", condition: "흐림", high: 27, low: 22, rain: 40 },
    { day: "목", condition: "맑음", high: 28, low: 22, rain: 10 },
    { day: "금", condition: "구름 많음", high: 27, low: 23, rain: 30 },
    { day: "토", condition: "비", high: 25, low: 22, rain: 75 },
    { day: "일", condition: "흐림", high: 26, low: 21, rain: 45 },
    { day: "월", condition: "맑음", high: 28, low: 22, rain: 15 },
  ],
};

export function getMockWeather() {
  return mockWeather;
}
