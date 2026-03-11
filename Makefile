PRETTIER ?= npx --yes prettier@3
NPM ?= npm
FORMAT_PATHS := package.json public/*.js public/*.html src/*.js src/*.mjs test/*.mjs

.PHONY: format dev test

format:
	$(PRETTIER) -- --write $(FORMAT_PATHS)

dev:
	$(NPM) run dev

test:
	$(NPM) test
