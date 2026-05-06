const OWM_KEY = process.env.OWM_API_KEY;

async function geocode(place) {
  const encoded = encodeURIComponent(place);
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&accept-language=sv&addressdetails=1`;
    const nomRes = await fetch(nomUrl, { headers: { 'User-Agent': 'OptimistVader/1.0 contact@example.com' } });
    const nomData = await nomRes.json();
    if (nomData?.length) {
      const placeTypes = ['city', 'town', 'village', 'municipality', 'hamlet'];
      const best = nomData.find(r => placeTypes.includes(r.type) || placeTypes.includes(r.addresstype)) || nomData[0];
      const name = best.address?.city || best.address?.town || best.address?.village || best.name;
      const country = best.address?.country || '';
      const countryCode = best.address?.country_code?.toUpperCase() || '';
      return { lat: parseFloat(best.lat), lon: parseFloat(best.lon), name, country, countryCode };
    }
  } catch { }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=10&language=sv&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error('Platsen hittades inte – kontrollera stavningen');
  const hasSwedishChars = /[åäöÅÄÖ]/.test(place);
  const sweResult = data.results.find(r => r.country_code === 'SE');
  const r = (hasSwedishChars && sweResult) ? sweResult : data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country, countryCode: r.country_code?.toUpperCase() || '' };
}

async function fetchYr(lat, lon, days) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'OptimistVader/1.0 contact@example.com' } });
  const data = await res.json();
  const hours = days === 1 ? 24 : 168;
  const timeseries = data.properties.timeseries.slice(0, hours);
  let totalSnow = 0, totalRain = 0, maxWind = 0, sunHours = 0, maxTemp = -99;
  for (const t of timeseries) {
    const d = t.data.next_1_hours?.details || t.data.next_6_hours?.details || {};
    totalSnow += d.precipitation_amount || 0;
    totalRain += d.precipitation_amount || 0;
    maxWind = Math.max(maxWind, t.data.instant.details.wind_speed || 0);
    maxTemp = Math.max(maxTemp, t.data.instant.details.air_temperature || -99);
    if ((t.data.instant.details.cloud_area_fraction || 100) < 30) sunHours += 1;
  }
  return { source: 'yr.no', snow: Math.round(totalSnow * 0.1), rain: Math.round(totalRain), wind: Math.round(maxWind), sun: Math.round(sunHours), maxTemp: Math.round(maxTemp), uv: null };
}

async function fetchOpenMeteo(lat, lon, days) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max,uv_index_max&forecast_days=${days}&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  return {
    source: 'Open-Meteo',
    snow: Math.round(d.snowfall_sum.reduce((a, b) => a + (b || 0), 0)),
    rain: Math.round(d.precipitation_sum.reduce((a, b) => a + (b || 0), 0)),
    wind: Math.round(Math.max(...d.windspeed_10m_max.map(v => v || 0))),
    sun: Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600),
    maxTemp: Math.round(Math.max(...d.temperature_2m_max.map(v => v || 0))),
    uv: Math.round(Math.max(...(d.uv_index_max || [0]).map(v => v || 0)))
  };
}

async function fetchOpenMeteoIcon(lat, lon, days) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max,uv_index_max&forecast_days=${days}&timezone=auto&models=icon_seamless`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  return {
    source: 'Open-Meteo (ICON)',
    snow: Math.round(d.snowfall_sum.reduce((a, b) => a + (b || 0), 0)),
    rain: Math.round(d.precipitation_sum.reduce((a, b) => a + (b || 0), 0)),
    wind: Math.round(Math.max(...d.windspeed_10m_max.map(v => v || 0))),
    sun: Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600),
    maxTemp: Math.round(Math.max(...d.temperature_2m_max.map(v => v || 0))),
    uv: Math.round(Math.max(...(d.uv_index_max || [0]).map(v => v || 0)))
  };
}

async function fetchOpenMeteoGFS(lat, lon, days) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max,uv_index_max&forecast_days=${days}&timezone=auto&models=gfs_seamless`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  return {
    source: 'Open-Meteo (GFS)',
    snow: Math.round(d.snowfall_sum.reduce((a, b) => a + (b || 0), 0)),
    rain: Math.round(d.precipitation_sum.reduce((a, b) => a + (b || 0), 0)),
    wind: Math.round(Math.max(...d.windspeed_10m_max.map(v => v || 0))),
    sun: Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600),
    maxTemp: Math.round(Math.max(...d.temperature_2m_max.map(v => v || 0))),
    uv: Math.round(Math.max(...(d.uv_index_max || [0]).map(v => v || 0)))
  };
}

async function fetchOpenMeteoECMWF(lat, lon, days) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max,uv_index_max&forecast_days=${days}&timezone=auto&models=ecmwf_ifs04`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  return {
    source: 'Open-Meteo (ECMWF)',
    snow: Math.round(d.snowfall_sum.reduce((a, b) => a + (b || 0), 0)),
    rain: Math.round(d.precipitation_sum.reduce((a, b) => a + (b || 0), 0)),
    wind: Math.round(Math.max(...d.windspeed_10m_max.map(v => v || 0))),
    sun: Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600),
    maxTemp: Math.round(Math.max(...d.temperature_2m_max.map(v => v || 0))),
    uv: Math.round(Math.max(...(d.uv_index_max || [0]).map(v => v || 0)))
  };
}

async function fetchOWM(lat, lon, days) {
  if (!OWM_KEY) return null;
  const cnt = days === 1 ? 8 : 56;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&cnt=${cnt}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.list) return null;
  let totalSnow = 0, totalRain = 0, maxWind = 0, sunHours = 0, maxTemp = -99;
  for (const item of data.list) {
    totalSnow += item.snow?.['3h'] || 0;
    totalRain += item.rain?.['3h'] || 0;
    maxWind = Math.max(maxWind, item.wind?.speed || 0);
    maxTemp = Math.max(maxTemp, item.main?.temp_max || 0);
    if ((item.clouds?.all || 100) < 30) sunHours += 0.5;
  }
  return { source: 'OpenWeatherMap', snow: Math.round(totalSnow / 10), rain: Math.round(totalRain), wind: Math.round(maxWind), sun: Math.round(sunHours), maxTemp: Math.round(maxTemp), uv: null };
}

async function fetchSMHI(lat, lon, days) {
  // SMHI only covers Sweden (roughly lat 55-70, lon 10-25)
  if (lat < 54.5 || lat > 70.5 || lon < 9.5 || lon > 25.5) return null;
  const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const limit = days === 1 ? 24 : 168;
    let totalSnow = 0, totalRain = 0, maxWind = 0, sunHours = 0, maxTemp = -99;
    for (const t of (data.timeSeries?.slice(0, limit) || [])) {
      const params = {};
      for (const p of t.parameters) params[p.name] = p.values[0];
      // pcat: 0=no precip, 1=snow, 2=sleet, 3=rain, 4=freezing rain, 5=freezing drizzle
      const precip = params['pmean'] || 0;
      const pcat = params['pcat'] ?? 3;
      if (pcat <= 2) totalSnow += precip; // snow or sleet counts as snow
      totalRain += precip;
      maxWind = Math.max(maxWind, params['ws'] || 0);
      maxTemp = Math.max(maxTemp, params['t'] ?? -99);
      // Wsymb2: 1-2 = clear sky, use for sun hours estimate
      const wsymb = params['Wsymb2'] || 99;
      if (wsymb <= 2) sunHours += 1;
    }
    return {
      source: 'SMHI',
      snow: Math.round(totalSnow),
      rain: Math.round(totalRain),
      wind: Math.round(maxWind),
      sun: Math.round(sunHours),
      maxTemp: Math.round(maxTemp),
      uv: null
    };
  } catch { return null; }
}


async function fetchBergfex(place, lat, lon, days) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return null;

  // Build a targeted search query for Bergfex
  const query = `site:bergfex.com weather forecast ${place} snow sunshine temperature`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a weather data extractor. Search Bergfex for weather forecasts and return ONLY a JSON object with these exact fields:
{
  "snow": <total snowfall in cm, integer>,
  "rain": <total precipitation in mm, integer>,
  "wind": <max wind speed in m/s, integer>,
  "sun": <sunshine hours, integer>,
  "maxTemp": <max temperature in celsius, integer>,
  "uv": null
}
If you cannot find data, return {"error": "not found"}.
No explanation, no markdown, only the JSON object.`,
        messages: [{
          role: 'user',
          content: `Search Bergfex for the weather forecast for ${place} (lat ${lat.toFixed(2)}, lon ${lon.toFixed(2)}) for ${days === 1 ? 'today' : 'the next 7 days'}. Extract: total snowfall (cm), precipitation (mm), max wind (m/s), sunshine hours, max temperature (°C).`
        }]
      })
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Extract text from response (skip tool_use blocks)
    const text = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.error) return null;

    return {
      source: 'Bergfex',
      snow: parsed.snow ?? 0,
      rain: parsed.rain ?? 0,
      wind: parsed.wind ?? 0,
      sun: parsed.sun ?? 0,
      maxTemp: parsed.maxTemp ?? 0,
      uv: null
    };
  } catch { return null; }
}
export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const place = params.place;
  const mode = params.mode || 'snow';
  const days = parseInt(params.days) === 7 ? 7 : 1;

  if (!place) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Ingen ort angiven' }) };
  }

  try {
    const location = await geocode(place);
    const { lat, lon } = location;

    const results = await Promise.allSettled([
      fetchYr(lat, lon, days),
      fetchOpenMeteo(lat, lon, days),
      fetchOpenMeteoIcon(lat, lon, days),
      fetchOpenMeteoGFS(lat, lon, days),
      fetchOpenMeteoECMWF(lat, lon, days),
      fetchOWM(lat, lon, days),
      fetchSMHI(lat, lon, days),
      fetchBergfex(place, lat, lon, days),
    ]);

    const sources = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    if (!sources.length) throw new Error('Kunde inte hämta väderdata');

    const modeKey = { snow: 'snow', sun: 'sun' }[mode] || 'snow';
    const winner = sources.reduce((a, b) => (b[modeKey] > a[modeKey] ? b : a), sources[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ location, winner, sourcesCount: sources.length, mode, days })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
