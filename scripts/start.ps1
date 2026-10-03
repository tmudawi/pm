Set-Location (Join-Path $PSScriptRoot "..")
docker build -t pm-app .
if ($LASTEXITCODE -ne 0) { exit 1 }
docker rm -f pm-app 2>$null | Out-Null
docker run -d --name pm-app -p 8000:8000 -v pm-data:/app/data --env-file .env pm-app
Write-Output "Running at http://localhost:8000"
