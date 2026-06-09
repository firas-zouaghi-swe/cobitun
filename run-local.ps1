# Run this script from the project root in PowerShell.
# It builds the Docker image and then starts the container on port 3000.

$ImageName = 'cobitun-app'

docker build -t $ImageName .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed. Fix the errors above before running again."
    exit $LASTEXITCODE
}

Write-Host "Docker build succeeded. Running container..."
Write-Host "Open http://localhost:3000 in your browser."

docker run --rm -p 3000:3000 $ImageName
