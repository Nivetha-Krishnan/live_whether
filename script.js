// ---------- API endpoints (Open-Meteo: free, no API key needed) ----------
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// ---------- Weather code -> icon + description ----------
const WEATHER_CODES = {
  0: ["☀️", "Clear sky"],
  1: ["🌤️", "Mainly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌦️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Freezing drizzle"],
  61: ["🌧️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["❄️", "Snow grains"],
  80: ["🌦️", "Rain showers"],
  81: ["🌧️", "Rain showers"],
  82: ["⛈️", "Violent showers"],
  85: ["🌨️", "Snow showers"],
  86: ["🌨️", "Snow showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm with hail"],
  99: ["⛈️", "Thunderstorm with hail"]
};
const lookup = (code) => WEATHER_CODES[code] || ["🌡️", "Unknown"];

// ---------- DOM references ----------
const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const button = document.getElementById("search-btn");
const fieldError = document.getElementById("field-error");
const output = document.getElementById("output");

// ---------- Input validation ----------
function validateCity(value) {
  const city = value.trim();
  if (!city) return "Please enter a city name.";
  if (city.length < 2) return "City name must be at least 2 characters.";
  if (!/^[\p{L}\s.'-]+(,\s*[\p{L}\s.'-]+)?$/u.test(city)) {
    return "Use letters only (no numbers or special characters).";
  }
  return "";
}

function showFieldError(message) {
  fieldError.textContent = message;
  input.classList.toggle("invalid", Boolean(message));
}

// ---------- Dynamic DOM injection ----------
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderState(type, message) {
  output.innerHTML = "";
  const box = document.createElement("div");
  box.className = "state " + (type === "error" ? "error" : "");
  if (type === "loading") {
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    box.appendChild(spinner);
  }
  const text = document.createElement("p");
  text.textContent = message;
  box.appendChild(text);
  output.appendChild(box);
}

function renderWeather(place, data) {
  const { current, daily } = data;
  const [icon, desc] = lookup(current.weather_code);
  const label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");

  output.innerHTML = `
    <div class="current">
      <div>
        <div class="city">${escapeHTML(label)}</div>
        <div class="desc">${desc}</div>
        <div class="details">
          <span>Feels like ${Math.round(current.apparent_temperature)}°C</span>
          <span>Humidity ${current.relative_humidity_2m}%</span>
          <span>Wind ${Math.round(current.wind_speed_10m)} km/h</span>
        </div>
      </div>
      <div class="right">
        <div class="icon">${icon}</div>
        <div class="temp">${Math.round(current.temperature_2m)}°C</div>
      </div>
    </div>
    <h2>5-day forecast</h2>
    <div class="forecast" id="forecast"></div>
  `;

  const forecastEl = document.getElementById("forecast");
  daily.time.forEach((dateStr, i) => {
    const date = new Date(dateStr + "T00:00:00");
    const [dayIcon, dayDesc] = lookup(daily.weather_code[i]);
    const card = document.createElement("div");
    card.className = "day";
    card.title = dayDesc;
    card.innerHTML = `
      <div class="name">${i === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}</div>
      <div class="date">${date.toLocaleDateString("en-US", { day: "numeric", month: "short" })}</div>
      <div class="icon">${dayIcon}</div>
      <div class="hi">${Math.round(daily.temperature_2m_max[i])}°</div>
      <div class="lo">${Math.round(daily.temperature_2m_min[i])}°</div>
    `;
    forecastEl.appendChild(card);
  });
}

// ---------- Fetch with async/await ----------
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Server error (" + response.status + ")");
  return response.json();
}

async function getCoordinates(city) {
  const data = await fetchJSON(
    `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  if (!data.results || data.results.length === 0) {
    throw new Error("NOT_FOUND");
  }
  return data.results[0];
}

async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    forecast_days: 5,
    timezone: "auto"
  });
  return fetchJSON(`${WEATHER_URL}?${params}`);
}

async function searchCity(city) {
  button.disabled = true;
  renderState("loading", "Fetching weather for " + city + "…");
  try {
    const place = await getCoordinates(city);
    const weather = await getWeather(place.latitude, place.longitude);
    renderWeather(place, weather);
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      renderState("error", `City "${city}" was not found. Check the spelling and try again.`);
    } else if (err instanceof TypeError) {
      renderState("error", "Network error. Check your internet connection and try again.");
    } else {
      renderState("error", "Something went wrong: " + err.message);
    }
  } finally {
    button.disabled = false;
  }
}

// ---------- Events ----------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const error = validateCity(input.value);
  showFieldError(error);
  if (error) return;
  searchCity(input.value.trim());
});

input.addEventListener("input", () => showFieldError(""));

// Load a default city on first visit
searchCity("Chennai");