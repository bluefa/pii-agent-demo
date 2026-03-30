FRONT_VERSION=latest

GCR_HOST := gcr.io

DEV_TAG := bdp-dip-dev/self-installation-front:$(FRONT_VERSION)
STG_TAG := sec-bdp-dev/self-installation-front:$(FRONT_VERSION)
PRD_TAG := bigdata-platform-system/self-installation-front:$(FRONT_VERSION)


.PHONY: build
build:
	docker build -t tmp:latest .

# DEV
.PHONY: build-dev
build-dev: build
	docker tag tmp:latest $(GCR_HOST)/$(DEV_TAG)

.PHONY: push-dev
push-dev: build-dev
	docker push $(GCR_HOST)/$(DEV_TAG)

.PHONY: restart-dev
restart-dev: push-dev
	kubectl rollout restart deploy/self-installation-front

# STG
.PHONY: build-stg
build-stg: build
	docker tag tmp:latest $(GCR_HOST)/$(STG_TAG)

.PHONY: push-stg
push-stg: build-stg
	docker push $(GCR_HOST)/$(STG_TAG)

.PHONY: restart-stg
restart-stg: push-stg
	kubectl rollout restart deploy/self-installation-front

# PRD
.PHONY: build-prd
build-prd: build
	docker tag tmp:latest $(GCR_HOST)/$(PRD_TAG)

.PHONY: push-prd
push-prd: build-prd
	docker push $(GCR_HOST)/$(PRD_TAG)

.PHONY: restart-prd
restart-prd: push-prd
	kubectl rollout restart deploy/self-installation-front