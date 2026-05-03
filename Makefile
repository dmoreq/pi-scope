FOLDER ?=
TSX    := npx tsx

.PHONY: help build test debug debug-plain

help:
	@echo ""
	@echo "  make build               Compile TypeScript → dist/"
	@echo "  make test                Run all tests"
	@echo "  make debug FOLDER=<dir>  Full debug run against a project folder"
	@echo ""
	@echo "  Options (append after FOLDER=...):"
	@echo "    TS_TOP=30              Show top 30 TypeScript files (default: 20)"
	@echo "    NO_TS=1                Skip TypeScript dep graph"
	@echo "    EXCLUDE='vendor/**'    Extra exclude glob"
	@echo "    PLAIN=1                No ANSI colour (same as debug-plain)"
	@echo ""
	@echo "  Examples:"
	@echo "    make debug FOLDER=~/projects/my-app"
	@echo "    make debug FOLDER=~/projects/my-app TS_TOP=5 EXCLUDE='crates/brush-*/**'"
	@echo "    make debug FOLDER=~/projects/my-app PLAIN=1 | less"
	@echo "    make debug FOLDER=~/projects/my-app > report.txt"
	@echo ""

build:
	$(TSX) tsc

test:
	$(TSX) vitest run

# Build the tsx flags from make variables
_FLAGS :=
_FLAGS += $(if $(TS_TOP),--ts-top $(TS_TOP),)
_FLAGS += $(if $(NO_TS),--no-ts,)
_FLAGS += $(if $(EXCLUDE),--exclude '$(EXCLUDE)',)
_FLAGS += $(if $(PLAIN),--no-color,)

debug:
ifndef FOLDER
	$(error FOLDER is required. Usage: make debug FOLDER=/path/to/project)
endif
	@$(TSX) bin/debug.ts "$(FOLDER)" $(_FLAGS)

debug-plain:
ifndef FOLDER
	$(error FOLDER is required. Usage: make debug-plain FOLDER=/path/to/project)
endif
	@$(TSX) bin/debug.ts "$(FOLDER)" --no-color $(_FLAGS)
