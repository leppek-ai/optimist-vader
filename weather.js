export const config = { runtime: 'edge' };

const OWM_KEY = process.env.OWM_API_KEY;

async function geocode(place) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=sv&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error('Platsen hittades inte');
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country };
}

async function fetchYr(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'OptimistVader/1.0 github.com/user/optimist-vader' } });
  const data = await res.json();
  const timeseries = data.properties.timeseries.slice(0, 56);
  let totalSnow = 0, totalRain = 0, totalWind = 0, sunHours = 0;
  for (const t of timeseries) {
    const d = t.data.next_6_hours?.details || t.data.next_1_hours?.details || {};
    totalSnow += d.precipitation_amount || 0;
    totalRain += d.precipitation_amount || 0;
    totalWind = Math.max(totalWind, t.data.instant.details.wind_speed || 0);
    const cloud = t.data.instant.details.cloud_area_fraction || 100;
    if (cloud < 30) sunHours += 1;
  }
  const temps = timeseries.map(t => t.data.instant.details.air_temperature || 0);
  const maxTemp = Math.max(...temps);
  return {
    source: 'yr.no',
    snow: Math.round(totalSnow * 0.1),
    rain: Math.round(totalRain),
    wind: Math.round(totalWind),
    sun: Math.round(sunHours),
    maxTemp: Math.round(maxTemp)
  };
}

async function fetchOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  const snow = d.snowfall_sum.reduce((a, b) => a + (b || 0), 0);
  const rain = d.precipitation_sum.reduce((a, b) => a + (b || 0), 0);
  const wind = Math.max(...d.windspeed_10m_max.map(v => v || 0));
  const sun = Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600);
  const maxTemp = Math.max(...d.temperature_2m_max.map(v => v || 0));
  return {
    source: 'Open-Meteo',
    snow: Math.round(snow),
    rain: Math.round(rain),
    wind: Math.round(wind),
    sun,
    maxTemp: Math.round(maxTemp)
  };
}

async function fetchOpenMeteoIcon(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=snowfall_sum,precipitation_sum,windspeed_10m_max,sunshine_duration,temperature_2m_max&forecast_days=7&timezone=auto&models=icon_seamless`;
  const res = await fetch(url);
  const data = await res.json();
  const d = data.daily;
  const snow = d.snowfall_sum.reduce((a, b) => a + (b || 0), 0);
  const rain = d.precipitation_sum.reduce((a, b) => a + (b || 0), 0);
  const wind = Math.max(...d.windspeed_10m_max.map(v => v || 0));
  const sun = Math.round(d.sunshine_duration.reduce((a, b) => a + (b || 0), 0) / 3600);
  const maxTemp = Math.max(...d.temperature_2m_max.map(v => v || 0));
  return {
    source: 'Open-Meteo (ICON)',
    snow: Math.round(snow),
    rain: Math.round(rain),
    wind: Math.round(wind),
    sun,
    maxTemp: Math.round(maxTemp)
  };
}

async function fetchOWM(lat, lon) {
  if (!OWM_KEY) return null;
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric&cnt=56`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.list) return null;
  let totalSnow = 0, totalRain = 0, maxWind = 0, sunHours = 0, maxTemp = -99;
  for (const item of data.list) {
    totalSnow += item.snow?.['3h'] || 0;
    totalRain += item.rain?.['3h'] || 0;
    maxWind = Math.max(maxWind, item.wind?.speed || 0);
    maxTemp = Math.max(maxTemp, item.main?.temp_max || 0);
    if (item.clouds?.all < 30) sunHours += 0.5;
  }
  return {
    source: 'OpenWeatherMap',
    snow: Math.round(totalSnow / 10),
    rain: Math.round(totalRain),
    wind: Math.round(maxWind),
    sun: Math.round(sunHours),
    maxTemp: Math.round(maxTemp)
  };
}

async function fetchSMHI(lat, lon) {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    let totalSnow = 0, totalRain = 0, maxWind = 0, sunHours = 0, maxTemp = -99;
    const series = data.timeSeries?.slice(0, 56) || [];
    for (const t of series) {
      const params = {};
      for (const p of t.parameters) params[p.name] = p.values[0];
      totalSnow += params['psnow'] || 0;
      totalRain += params['pmean'] || 0;
      maxWind = Math.max(maxWind, params['ws'] || 0);
      maxTemp = Math.max(maxTemp, params['t'] || 0);
      if ((params['tcc_mean'] || 8) < 3) sunHours += 0.25;
    }
    return {
      source: 'SMHI',
      snow: Math.round(totalSnow),
      rain: Math.round(totalRain),
      wind: Math.round(maxWind),
      sun: Math.round(sunHours),
      maxTemp: Math.round(maxTemp)
    };
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const place = searchParams.get('place');
  const mode = searchParams.get('mode') || 'snow';

  if (!place) {
    return new Response(JSON.stringify({ error: 'Ingen ort angiven' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const location = await geocode(place);
    const { lat, lon } = location;

    const results = await Promise.allSettled([
      fetchYr(lat, lon),
      fetchOpenMeteo(lat, lon),
      fetchOpenMeteoIcon(lat, lon),
      fetchOWM(lat, lon),
      fetchSMHI(lat, lon),
    ]);

    const sources = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    const modeKey = { snow: 'snow', sun: 'sun', rain: 'rain', wind: 'wind' }[mode] || 'snow';
    const winner = sources.reduce((a, b) => (b[modeKey] > a[modeKey] ? b : a), sources[0]);

    return new Response(JSON.stringify({ location, sources, winner, mode }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=1800'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
