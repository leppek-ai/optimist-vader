# Optimist-vädret

En app som jämför flera väderkällor och alltid visar det mest optimistiska utfallet.

## Källor
- yr.no (Norska meteorologiska institutet)
- Open-Meteo / ECMWF-modellen
- Open-Meteo / ICON-modellen (tysk vädermodell)
- OpenWeatherMap
- SMHI (fungerar bäst för svenska orter)

## Publicera på Vercel

### 1. Ladda upp koden till GitHub
1. Gå till github.com och logga in
2. Klicka på "+" → "New repository"
3. Namnge det t.ex. `optimist-vader`
4. Klicka "Create repository"
5. Följ instruktionerna för att ladda upp filerna (drag & drop fungerar)

### 2. Koppla GitHub till Vercel
1. Gå till vercel.com och logga in
2. Klicka "Add New Project"
3. Välj ditt GitHub-repo `optimist-vader`
4. Klicka "Deploy"

### 3. Lägg till din OpenWeatherMap-nyckel
1. I Vercel, gå till ditt projekt → Settings → Environment Variables
2. Lägg till:
   - Name: `OWM_API_KEY`
   - Value: (din nyckel från openweathermap.org)
3. Klicka Save och gör en ny deploy (Deployments → Redeploy)

Klart! Appen är nu live på din Vercel-URL.
