# Local Testing Setup

## 1. Add to /etc/hosts
```bash
sudo bash -c 'echo "127.0.0.1 zaitxmedia.test auth.zaitxmedia.test admin.zaitxmedia.test api.zaitxmedia.test" >> /etc/hosts'
```

## 2. Start OpenNext Preview
```bash
cd ~/Projects/zaitxmedia
npm run preview:cloudflare
```

## 3. Test URLs
- Main site: http://zaitxmedia.test:8787
- Auth: http://auth.zaitxmedia.test:8787/v3/get-session
- Admin: http://admin.zaitxmedia.test:8787
- API: http://api.zaitxmedia.test:8787/v1/health

## Local D1
- Database: zaitxmedia-local
- Tables: ba_users, ba_sessions, ba_accounts, ba_verifications, payment_methods, payment_destinations, payment_intents, sms_gateway_devices, payment_sms_events

## Build Status
- Next.js build: ✅
- OpenNext build: ✅
- Local D1 migrations: ✅ applied
