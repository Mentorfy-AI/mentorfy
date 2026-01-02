.PHONY: install dev web api

install:
	cd apps/web && pnpm install
	cd apps/api && uv sync

web:
	cd apps/web && pnpm dev

api:
	cd apps/api && uv run python start_server.py

dev:
	$(MAKE) -j2 web api
