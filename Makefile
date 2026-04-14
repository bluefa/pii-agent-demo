INSTALL_VERSION=latest

GCR_HOST := gcr.io

DEV_TAG := bdp-dip-dev/self-installation-front:$(INSTALL_VERSION)
STG_TAG := sec-bdp-dev/self-installation-front:$(INSTALL_VERSION)
PRD_TAG := bigdata-platform-system/self-installation-front:$(INSTALL_VERSION)

# DEV
.PHONY: build-dev
build-dev:
	docker build -t ${GCR_HOST}/${DEV_TAG} .

.PHONY: push-dev
push-dev: build-dev
	docker push ${GCR_HOST}/${DEV_TAG}

# STG
.PHONY: build-stg
build-stg:
	docker build -t ${GCR_HOST}/${STG_TAG} .

.PHONY: push-stg
push-stg: build-stg
	docker push ${GCR_HOST}/${STG_TAG}

# PRD
.PHONY: build-prd
build-prd:
	docker build -t ${GCR_HOST}/${PRD_TAG} .

.PHONY: push-prd
push-prd: build-prd
	docker push ${GCR_HOST}/${PRD_TAG}

# Local development
.PHONY: dev
dev:
	npm run dev

.PHONY: build
build:
	npm run build

.PHONY: start
start:
	npm run start

.PHONY: test
test:
	npm run test:run

.PHONY: lint
lint:
	npm run lint