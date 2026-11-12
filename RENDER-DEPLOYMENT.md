# Turis Tv — Mobiel zonder BAT via Render

GitHub Pages (`turis-tv.github.io/Turis-2027`) is alleen een statische website.
Voor de speler en stream-proxy moet de Next.js-server op Render draaien.

## 1. Update de repository

Zorg dat het bestand `render.yaml` uit het nieuwste project in de hoofdmap van
`Turis-Tv/Turis-2027` staat. De configuratie gebruikt `npm install` omdat er
geen `package-lock.json` nodig is.

## 2. Render-account koppelen

1. Open https://dashboard.render.com/
2. Registreer of log in met **GitHub**.
3. Geef Render toegang tot de repository **Turis-Tv/Turis-2027**.

## 3. Blueprint deployment

1. Klik rechtsboven op **New +**.
2. Kies **Blueprint**.
3. Selecteer **Turis-Tv/Turis-2027**.
4. Render vindt automatisch `render.yaml`.
5. Controleer dat er een webservice **turis-tv** en database **turis-tv-db** staat.
6. Klik op **Apply** / **Deploy Blueprint**.
7. Wacht tot de build klaar is. Dit kan 5–15 minuten duren.

## 4. Openen op je telefoon

1. Open in Render de webservice **turis-tv**.
2. Bovenaan staat de publieke URL, bijvoorbeeld:
   `https://turis-tv.onrender.com` of `https://turis-tv-xxxx.onrender.com`.
3. Open die **Render-URL** op je telefoon.
4. Je hebt geen BAT, Node.js, Cloudflare of een pc nodig.

Gebruik dus niet langer de GitHub Pages-URL voor het afspelen.

## Controle bij problemen

- **Build failed:** open de webservice → **Logs** en lees de laatste foutregel.
- **Service Unavailable bij eerste bezoek:** de gratis Render-server kan slapen;
  wacht 30–60 seconden en vernieuw.
- **Healthcheck:** open `https://JOUW-RENDER-URL/api/health`.
- **Kanalen blijven laden:** open `https://JOUW-RENDER-URL/api/channels`; die moet
  een JSON-lijst met 37 kanalen teruggeven.

De PIN voor de afgeschermde links blijft dezelfde als lokaal.
