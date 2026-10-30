"""
Phantom Engine — main entry point.

Today this serves the read-only HTTP API (Track B). The perception loop
(capture -> gate -> understand -> commit) from Track A will be started here too at
integration (M2); see the INTEGRATION HOOK below.

Run: `python -m apps.engine.main`  (or `make run`).
"""
import uvicorn


def main() -> None:
    print("🔮 Phantom Engine Starting...")
    print("📡 API:  http://localhost:8000/api/health")
    print("📚 Docs: http://localhost:8000/docs")

    # INTEGRATION HOOK (Track A / Dhwanit): start the capture->gate->understand->commit
    # loop in a background thread here, sharing one MemoryStore with the API via the
    # engine's write side. The API created below is read-only.

    uvicorn.run(
        "apps.engine.api:get_app",
        factory=True,
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    main()
