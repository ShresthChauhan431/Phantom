.PHONY: help install run dashboard test seed clean

help:
	@echo "Phantom — Development Commands"
	@echo ""
	@echo "  make install    Install all dependencies (Python + Node)"
	@echo "  make run        Start the backend engine daemon"
	@echo "  make dashboard  Start the React dashboard dev server"
	@echo "  make test       Run all tests"
	@echo "  make seed       Seed demo data"
	@echo "  make clean      Clean build artifacts and cache"

install:
	python3 -m venv .venv
	.venv/bin/pip install -e ".[dev]"
	npm install

run:
	.venv/bin/python -m apps.engine.main

dashboard:
	npm run dev --workspace=apps/dashboard

test:
	.venv/bin/pytest

seed:
	.venv/bin/python scripts/seed_demo.py --reset

clean:
	rm -rf __pycache__ .pytest_cache .ruff_cache
	rm -rf apps/dashboard/node_modules apps/dashboard/dist
	rm -rf data/*.db
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
