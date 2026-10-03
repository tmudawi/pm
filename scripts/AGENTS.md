# Scripts

Build the Docker image `pm-app` from the project root `Dockerfile` and run it as container `pm-app` on port 8000.

- `start.sh` / `stop.sh` - Mac and Linux.
- `start.ps1` / `stop.ps1` - Windows (`powershell -ExecutionPolicy Bypass -File scripts/start.ps1`).

`start` rebuilds the image and replaces any running container. `stop` removes the container.
