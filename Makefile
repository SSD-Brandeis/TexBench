SHELL := /bin/bash
.DEFAULT_GOAL := up

PRETTIER ?= npx --yes prettier@3
NPM ?= npm
TLC ?= tlc
BOOTSTRAP_INFO ?= bash scripts/bootstrap-info.sh
BOOTSTRAP_PLATFORM ?= $(shell $(BOOTSTRAP_INFO) platform)
BOOTSTRAP_NODE_VERSION ?= $(shell $(BOOTSTRAP_INFO) node-version)
BOOTSTRAP_JAVA_VERSION ?= $(shell $(BOOTSTRAP_INFO) java-version)
BOOTSTRAP_OLLAMA_MODEL ?= $(shell $(BOOTSTRAP_INFO) ollama-model)
BOOTSTRAP_TECTONIC_ASSET ?= $(shell $(BOOTSTRAP_INFO) tectonic-asset)
BOOTSTRAP_TECTONIC_URL ?= $(shell $(BOOTSTRAP_INFO) tectonic-url)
BOOTSTRAP_CASSANDRA_VERSION ?= $(shell $(BOOTSTRAP_INFO) cassandra-version)
FORMAT_PATHS := package.json public/*.js public/*.html src/*.js src/*.mjs test/*.mjs

.PHONY: format dev up bootstrap-info package-tectonic test test-demo test-demo-ollama test-ollama-regressions test-formal test-formal-js test-formal-tla check-ai-env check-demo-ai-env

format:
	$(PRETTIER) -- --write $(FORMAT_PATHS)

up:
	bash scripts/run-local-dev.sh

bootstrap-info:
	@echo "Platform: $(BOOTSTRAP_PLATFORM)"
	@echo "Node.js: $(BOOTSTRAP_NODE_VERSION)"
	@echo "Java: $(BOOTSTRAP_JAVA_VERSION)"
	@echo "Ollama model: $(BOOTSTRAP_OLLAMA_MODEL)"
	@echo "Ollama digest: $(shell $(BOOTSTRAP_INFO) ollama-digest)"
	@echo "Cassandra: $(BOOTSTRAP_CASSANDRA_VERSION)"
	@echo "tectonic-cli asset: $(BOOTSTRAP_TECTONIC_ASSET)"
	@echo "tectonic-cli URL: $(BOOTSTRAP_TECTONIC_URL)"

package-tectonic:
	bash scripts/package-tectonic-cli.sh

package-tectonic-all:
	PACKAGE_PLATFORMS="darwin-arm64,darwin-x64,linux-arm64,linux-x64" bash scripts/package-tectonic-cli.sh

check-ai-env:
	@provider="$${AI_PROVIDER:-openai}"; \
	if [ "$$provider" = "cloudflare" ]; then \
		test -n "$$CLOUDFLARE_ACCOUNT_ID" || (echo "CLOUDFLARE_ACCOUNT_ID is not set" >&2; exit 1); \
		test -n "$$CLOUDFLARE_API_TOKEN" || (echo "CLOUDFLARE_API_TOKEN is not set" >&2; exit 1); \
	elif [ "$$provider" = "ollama" ]; then \
		true; \
	else \
		test -n "$$OPENAI_API_KEY" || (echo "OPENAI_API_KEY is not set" >&2; exit 1); \
	fi

check-demo-ai-env:
	@test -n "$$OPENAI_API_KEY" || (echo "OPENAI_API_KEY is not set" >&2; exit 1)
	@test -n "$$CLOUDFLARE_ACCOUNT_ID" || (echo "CLOUDFLARE_ACCOUNT_ID is not set" >&2; exit 1)
	@test -n "$$CLOUDFLARE_API_TOKEN" || (echo "CLOUDFLARE_API_TOKEN is not set" >&2; exit 1)

dev:
	bash scripts/run-local-dev.sh

test:
	$(NPM) test

test-demo:
	AI_PROVIDER=ollama OLLAMA_MODEL=llama3:8b node --test test/ui-structured-normalization.test.mjs test/assist-interpreter-invariants.test.mjs test/assist-dsl-coverage.test.mjs test/assist-chat-session.test.mjs test/assist-intent-boundaries.test.mjs test/assist-intent-matrix.test.mjs test/assist-structural-paraphrases.test.mjs test/assist-natural-language-demo.test.mjs test/assist-natural-language-extended.test.mjs test/assist-provider-coverage.test.mjs

test-demo-ollama:
	AI_PROVIDER=ollama node --test test/ui-structured-normalization.test.mjs test/assist-interpreter-invariants.test.mjs test/assist-dsl-coverage.test.mjs test/assist-chat-session.test.mjs test/assist-intent-boundaries.test.mjs test/assist-intent-matrix.test.mjs test/assist-structural-paraphrases.test.mjs test/assist-natural-language-demo.test.mjs test/assist-natural-language-extended.test.mjs test/assist-provider-coverage.test.mjs

test-ollama-regressions:
	AI_PROVIDER=ollama OLLAMA_MODEL=llama3:8b node --test test/assist-ollama-regressions.test.mjs
	@if node --input-type=module -e 'import("@playwright/test").then(() => process.exit(0)).catch(() => process.exit(1))'; then \
		AI_PROVIDER=ollama OLLAMA_MODEL=llama3:8b npx --yes @playwright/test test test/assist-ollama-browser-smoke.spec.mjs --reporter=line; \
	else \
		echo "Skipping browser smoke: install @playwright/test to enable test/assist-ollama-browser-smoke.spec.mjs"; \
	fi

test-formal: test-formal-js test-formal-tla

test-formal-js:
	node --test test/assist-interpreter-invariants.test.mjs

test-formal-tla:
	$(TLC) docs/formal/assist_interpreter.tla -config docs/formal/assist_interpreter.cfg
