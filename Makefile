PRETTIER ?= npx --yes prettier@3
NPM ?= npm
FORMAT_PATHS := package.json public/*.js public/*.html src/*.js src/*.mjs test/*.mjs

.PHONY: format dev test check-cloudflare-env

format:
	$(PRETTIER) -- --write $(FORMAT_PATHS)

check-cloudflare-env:
	@test -n "$(CLOUDFLARE_ACCOUNT_ID)" || (echo "CLOUDFLARE_ACCOUNT_ID is not set" >&2; exit 1)
	@test -n "$(CLOUDFLARE_API_TOKEN)" || (echo "CLOUDFLARE_API_TOKEN is not set" >&2; exit 1)

dev: check-cloudflare-env
	$(NPM) run dev

test:
	$(NPM) test
