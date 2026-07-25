# MoniBot Tempo Reply Service v1.0

AI-powered Twitter reply service for Tempo Testnet (aUSD) transactions.

## Features
- Polls `monibot_transactions` for `chain='tempo'` unreplied records
- Generates AI replies via monibot-ai Edge Function
- Tempo-specific reply templates with αUSD references
- Explorer links to `https://explore.tempo.xyz`
- Duplicate reply prevention with similarity checking

## Setup
```bash
cp .env.example .env
# Fill in your credentials
npm install
npm start
```

## Docker
```bash
docker build -t monibot-reply-tempo .
docker run -d --env-file .env monibot-reply-tempo
```
