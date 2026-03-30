FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# 빌드 시점에는 기본값 또는 빈 값으로 빌드
# (서버 전용 변수는 런타임에 주입할 것이므로)
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 필요한 파일만 복사
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# 환경변수는 여기서 하드코딩하지 않음 → K8s에서 주입
CMD ["node", "server.js"]
