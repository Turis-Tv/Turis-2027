$uri = "http://127.0.0.1:3000"

# Wacht tot Next.js echt antwoordt; geen vaste vertraging meer.
for ($attempt = 0; $attempt -lt 150; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            Start-Process $uri
            exit 0
        }
    }
    catch {
        # Server is nog niet klaar; opnieuw proberen.
    }
    Start-Sleep -Seconds 2
}

Write-Host "Turis Tv kon niet automatisch worden geopend. Controleer het servervenster."
