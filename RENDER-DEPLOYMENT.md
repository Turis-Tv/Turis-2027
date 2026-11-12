# Turis Tv — gratis op Render, zonder BAT

De app heeft geen betaalde database nodig. Zonder PostgreSQL gebruikt hij de
37 ingebouwde kanalen automatisch.

## A. Automatisch via Blueprint

1. Vervang `render.yaml` in de hoofdmap van `Turis-Tv/Turis-2027` door de
   nieuwste versie.
2. Open https://dashboard.render.com/ en log in met GitHub.
3. Kies **New + → Blueprint**.
4. Selecteer **Turis-Tv/Turis-2027**.
5. Klik **Apply / Deploy Blueprint**.
6. Open daarna de Render-URL van de webservice op je telefoon.

## B. Handmatige instellingen via New Service

Gebruik deze waarden als je het scherm **New Service** ziet:

- **Compute:** `$0 / month — Free`
- **Repository:** `Turis-Tv/Turis-2027`
- **Branch:** `main`
- **Root Directory:** leeg laten
- **Runtime / Language:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`
- **Health Check Path:** `/api/health`
- **Region:** dichtstbijzijnde regio, bijvoorbeeld Frankfurt
- **Persistent disk / betaalde add-ons:** niet toevoegen

Environment variables:

- `NODE_VERSION` = `22.16.0`
- `DATABASE_URL` = `postgresql://postgres:postgres@127.0.0.1:5432/app_db`
- `LINK_PIN_HASH` = `954446921d7cda37f7f285ffbd7df61b5215886a1ff2b7abb55c4c29f151011f`
- `SESSION_SECRET` = een willekeurige lange geheime tekst

Klik daarna op **Deploy Web Service**. Kies nooit `$7 / month` als je de gratis
versie wilt.

## Mobiel openen

Open de publieke `onrender.com`-URL van de webservice op je telefoon. Geen BAT,
pc, Cloudflare of GitHub Pages meer nodig.

De gratis service kan na inactiviteit slapen; de eerste opening kan 30–60
seconden duren. Controle indien nodig:

- `https://JOUW-RENDER-URL/api/health`
- `https://JOUW-RENDER-URL/api/channels`
