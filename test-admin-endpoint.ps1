# PowerShell Script zum Aufruf des Admin-Endpoints

$uri = "https://gichttagebuchservice-936354735458.europe-west1.run.app/api/v1/admin/make-admin"
$body = @{
    email = "dunker.thorsten@gmail.com"
} | ConvertTo-Json

Write-Host "Sende Request an: $uri"
Write-Host "Body: $body"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "Erfolg!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Fehler:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
}


