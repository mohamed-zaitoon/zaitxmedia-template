# zaitxmedia Store Provider Server

Small Node server that keeps the Fazer API key private and exposes the public endpoints used by the storefront.

## Environment

Create `provider-server/.env` on the host:

```bash
FAZER_API_KEY=your_api_key
SMMX_API_KEY=your_smmx_api_key
USD_TO_EGP_RATE=50
USD_RATE_PADDING_EGP=7
CORS_ORIGIN=https://zaitxmedia.com
PORT=8787
```

Do not put the API key in any `NEXT_PUBLIC_` variable.

## Run

```bash
npm run provider
```

Endpoints:

- `GET /health`
- `GET /catalog`
- `GET /offers?kind=topup&id=cat_id`
- `GET /smmx/services`

Point the storefront to the deployed server URL:

```bash
NEXT_PUBLIC_PROVIDER_API_BASE_URL=https://your-provider-server.example.com
```
