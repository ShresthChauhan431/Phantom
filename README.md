# Phantom

**Ambient spatial memory for everyday life.**

Phantom watches your space through a phone camera, understands what moves and where, and remembers for you. No wearables, no manual input — just ambient intelligence that answers "where is X?" when you need it.

## Quick Start

### Install

```bash
# Install dependencies
make install

# Copy environment config
cp .env.example .env
# Edit .env with your API keys if using cloud VLM
```

### Run

```bash
# Terminal 1: Start the engine
make run

# Terminal 2: Start the dashboard
make dashboard

# Open http://localhost:5173
```

## Stack

- **Engine**: Python 3.12, FastAPI, OpenCV
- **VLM**: Ollama (local-first), OpenAI/Anthropic (escalation)
- **Store**: SQLite with WAL mode
- **Dashboard**: React + Vite + Tailwind
- **Camera**: scrcpy/adb (Android), Continuity Camera (iPhone), webcam (fallback)

## Repository Structure

See `docs/hello-phantom.md` for the full design document.

## Development

```bash
# Run tests
make test

# Seed demo data
make seed

# Clean artifacts
make clean
```

## License

MIT
