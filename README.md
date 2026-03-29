This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Real BFF For Swagger

실행형 Swagger는 아래 경로에서 확인합니다.

- `/integration/api-docs?spec=issue-222-client`

이 페이지의 `Try it out`은 브라우저가 BFF를 직접 호출하는 방식이 아니라, 먼저 Next.js API를 호출한 뒤 서버에서 BFF로 프록시합니다.

`Swagger UI` → `Next.js /api/integration/v1/**` → `BFF_API_URL + /install/v1/**`

실제 BFF 서버로 호출하려면 Next.js 실행 환경에 아래 설정을 추가하세요.

```bash
USE_MOCK_DATA=false
BFF_API_URL=http://your-bff-host:port
```

예시:

```bash
USE_MOCK_DATA=false \
BFF_API_URL=http://localhost:8080 \
npm run dev
```

그 다음 [http://localhost:3000/integration/api-docs?spec=issue-222-client](http://localhost:3000/integration/api-docs?spec=issue-222-client) 에서 확인하면 됩니다.

참고:

- upstream BFF 경로는 `/install/v1/**` 여야 합니다.
- 브라우저가 BFF를 직접 치지 않으므로 BFF CORS를 직접 열 필요는 없습니다.
- 현재 구현은 외부 BFF로 인증 헤더/쿠키를 자동 전달하지 않습니다. BFF가 별도 인증 없이 접근 가능하거나, 내부망/VPN에서 접근 가능해야 합니다.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
