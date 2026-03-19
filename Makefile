PRETTIER ?= npx --yes prettier@3
NPM ?= npm
FORMAT_PATHS := package.json public/*.js public/*.html src/*.js src/*.mjs test/*.mjs

.PHONY: format dev test test-demo test-demo-ollama check-ai-env check-demo-ai-env

format:
	$(PRETTIER) -- --write $(FORMAT_PATHS)

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

dev: check-ai-env
	$(NPM) run dev

test:
	$(NPM) test

test-demo:
	AI_PROVIDER=ollama OLLAMA_MODEL=llama3 node --test test/assist-chat-session.test.mjs test/assist-natural-language-demo.test.mjs test/assist-natural-language-extended.test.mjs test/assist-provider-coverage.test.mjs

test-demo-ollama:
	AI_PROVIDER=ollama node --test test/assist-chat-session.test.mjs test/assist-natural-language-demo.test.mjs test/assist-natural-language-extended.test.mjs test/assist-provider-coverage.test.mjs
