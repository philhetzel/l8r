"""
Modal deployment for Braintrust remote eval dev server (TypeScript evals).

This mirrors the "start a remote eval dev server" pattern, but instead of
returning an ASGI app (Python), we run the Braintrust Node CLI in --dev mode
and expose its HTTP port via @modal.web_server.
"""

from __future__ import annotations

import os
import subprocess

import modal  # type: ignore[import-not-found]
from modal import web_server  # type: ignore[import-not-found]

# Braintrust CLI default. Keep this fixed because @modal.web_server(port) is evaluated
# at import time (before runtime env vars are reliably available).
DEV_PORT = 8300


# Create image with all dependencies (Node + npm deps)
image = (
    modal.Image.debian_slim(python_version="3.11")
    # Install Node.js 20.x (avoid relying on distro node version)
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get update",
        "apt-get install -y nodejs",
        "node --version",
        "npm --version",
    )
    # Copy only package manifests into an image layer for deterministic installs
    .add_local_file("package.json", remote_path="/app/package.json", copy=True)
    .add_local_file(
        "package-lock.json", remote_path="/app/package-lock.json", copy=True
    )
    # Prisma client needs generation for @prisma/client imports to work at runtime.
    # We copy prisma/ into the image layer and run `prisma generate` once at build time.
    .add_local_dir("prisma", remote_path="/app/prisma", copy=True)
    .workdir("/app")
    .run_commands("npm ci")
    .run_commands('DATABASE_URL="file:/tmp/dev.db" npx prisma generate')
    # Add sources at runtime (faster iteration than baking into the image)
    .add_local_dir("src", remote_path="/app/src", copy=False)
    .add_local_dir("evals", remote_path="/app/evals", copy=False)
    .add_local_file("tsconfig.json", remote_path="/app/tsconfig.json", copy=False)
)

app = modal.App("l8r-braintrust-eval-devserver", image=image)

# Always read secrets from local .env and send them as a Secret (same pattern as your example)
_secrets = [modal.Secret.from_dotenv()]


@app.function(
    secrets=_secrets,
    # Keep the server warm with at least 1 instance
    min_containers=1,
    # Timeout for long-running sessions
    timeout=3600,
)
@web_server(DEV_PORT, startup_timeout=180)
def braintrust_eval_dev_server():
    """
    Run Braintrust eval dev server for TS evals.

    Connect to this endpoint from Braintrust Playground → Remote evals.
    """
    env = dict(os.environ)

    # Ensure the dev server binds to all interfaces inside the container.
    # Braintrust CLI defaults to localhost:8300 otherwise.
    cmd = [
        "npx",
        "braintrust",
        "eval",
        "evals/",
        "--dev",
        "--dev-host",
        "0.0.0.0",
        "--dev-port",
        str(DEV_PORT),
    ]

    # Important: for @web_server, start the server process and return.
    # Modal will keep the container alive and route traffic to the port.
    subprocess.Popen(cmd, cwd="/app", env=env)


@app.local_entrypoint()
def test():
    print("Deploy with: modal deploy deploy/modal_eval_server.py")
    print(f"Dev server will listen on port {DEV_PORT} (default 8300).")
