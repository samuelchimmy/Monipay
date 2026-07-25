### Contact
@bossop1

### CELO payout wallet
0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3

### Aigora profile URL
https://aigora.org/services/42220_0x8004a169fb4a3325136eb29fa0ceb6d2e539a432_9681

### Surface
Agent discovery / catalog

### Network
Both (Testnet — Celo Sepolia chainId 11142220 and Mainnet — Celo chainId 42220)

### Your feedback

We are the developers of Monipay — a social payments and AI agent layer on Celo — and registered our agent MoniBot during this hackathon. We went through the full registration flow twice (once landing on mainnet unintentionally, once successfully on testnet), and our agent wallet `0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3` was already being indexed by Aigora before we registered, producing a duplicate profile. Below are our specific findings.

---

**1. Silent Network Failover: Testnet Selection Silently Defaulted to Mainnet**

We selected "Testnet (Celo Sepolia)" during registration. However, the registration completed on Celo Mainnet (chainId 42220), not Sepolia. Our resulting profile ID `42220_0x8004a169fb4a3325136eb29fa0ceb6d2e539a432_9681` confirms this — the `42220` prefix is the mainnet chain ID. Our hypothesis is that Aigora detected insufficient testnet CELO in our wallet to cover gas, and silently fell back to mainnet where we had funds — without showing any warning, error, or confirmation prompt.

This is a critical silent failure. A user who selects testnet to sandbox their registration without spending real funds can unknowingly end up minting an on-chain mainnet NFT and spending real CELO gas. The correct behaviour should be: if the wallet cannot cover testnet gas, stop and display a clear error with a link to the Celo Sepolia faucet (https://faucet.celo.org/alfajores), never silently re-route to mainnet.

We subsequently funded a testnet wallet and re-registered successfully on Sepolia. That profile is at: https://aigora.org/services/11142220_0x8004a818bfb912233c491871b3d84c89a494bd9e_399

---

**2. Duplicate Agent Detection: Aigora Indexed Us Before Registration and Did Not Surface It**

Before we registered, Aigora had already auto-indexed MoniBot from our ERC-8004 on-chain metadata. We discovered an existing Aigora profile attributed to our agent wallet (`0xdFA5fe220cE7C4BCBb1180686666b803DfAE8ED3`) with 10 services already listed and 2 recent feedback entries. The registration flow had no awareness of this — it allowed us to create a fresh duplicate profile without any prompt or warning.

When a wallet connects to register an agent, Aigora should check whether that wallet address is already associated with an existing profile (whether auto-indexed or manually registered) and present it for confirmation. If a match is found, the flow should offer: "We found an existing agent profile linked to this wallet — would you like to update it instead of creating a new one?" Blindly allowing duplicate registrations fragments reputation, feedback history, and on-chain attribution across multiple profile IDs, which is harmful to both buyers and the marketplace integrity.

---

**3. No Programmatic Registration API or CLI — Autonomous Agents Cannot Self-Register**

The entire Aigora registration flow is locked behind a browser React UI. There is no REST API endpoint, no CLI tool, and no machine-readable pathway for an autonomous AI agent to register or update its own profile without human browser interaction.

Contrast this with Celo Builders, which provides clean REST API endpoints that AI agents call directly to register, update, and query submissions programmatically. Aigora should offer an equivalent: a `POST /api/agents/register` endpoint that accepts an `agent.json` metadata URL and a signed wallet message, or a CLI command such as `npx aigora register ./agent.json`. This is essential for Aigora to function as an agentic marketplace — if agents cannot self-list, the platform depends entirely on human operators.

---

**4. ERC-8004 Metadata Auto-Import Not Supported**

MoniBot publishes its complete service manifest at `https://monipay.xyz/agent.json` in the ERC-8004 format, including endpoint URLs, protocols, versions, pricing, capabilities, and social links. Despite this, Aigora required us to manually type and paste each of our 4 service endpoints, 8 social links, and all capability tags individually into the registration UI form.

Aigora should allow developers to supply their ERC-8004 `agent.json` URL at the top of the registration form and auto-populate all matching fields. This eliminates duplication errors, ensures consistency between the on-chain registry and the Aigora catalog, and dramatically reduces developer onboarding time.

---

**5. Form State Lost on Wallet Disconnect or Page Refresh**

The registration form has no draft persistence. During the dual-signature wallet transaction sequence, a wallet disconnect or accidental page refresh wipes all entered data: name, description, 4 service endpoints, 8 social links, and all capabilities. We experienced this firsthand and had to refill the entire form from scratch.

Aigora should persist draft form state in `localStorage`, keyed to the connected wallet address, so that a session can be resumed after a disconnect or refresh without any data loss.

---

**6. x402 Micropayment Type Not Declarable in Service Configuration**

MoniBot operates a live x402-paywalled endpoint on Celo. Calling it without payment returns a `402 Payment Required` response:

```
curl -i https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-x402/reputation-premium

HTTP/2 402
content-type: application/json
access-control-allow-origin: *
access-control-expose-headers: x-payment-response, X-ERC8004-Agent-Id, X-ERC8004-Registry, X-ERC8004-Feedback-Hint
x-erc8004-agent-id: 9103
x-erc8004-registry: 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432
```

When registering this service on Aigora, there is no way to declare that the endpoint uses `x402` as its payment protocol. The only pricing field is a flat USDC amount per session. As a result, buyers browsing the catalog have no indication that the endpoint is x402-compatible, what the per-request price is, or how to initiate payment. Aigora should add a "Payment Protocol" dropdown to service configuration (`free`, `x402`, `session`) and display x402 price and challenge details on the agent profile, so buyers know exactly how to call and pay for each service.

---

**7. Missing Catalog Search and Filter API**

Aigora currently has no publicly documented API for querying the agent catalog programmatically. For the marketplace to function as a true agentic ecosystem — where agents discover and hire other agents autonomously — there must be a REST endpoint such as `GET /api/agents?capability=payments&chain=celo&protocol=x402`. Without it, agent-to-agent discovery requires a human to browse the UI, which defeats the purpose of an autonomous agent workforce.

---

**8. No On-Chain Reputation or Trust Signals Surfaced on Profiles**

Aigora profiles display no on-chain transaction history, volume, or trust score. MoniBot already exposes a public reputation feed at `https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1/monibot-reputation` that aggregates trust scores, active payment campaigns, transaction volume, and statistics. Buyers on Aigora have no objective signal to evaluate whether an agent is trustworthy before hiring it. Aigora should surface on-chain reputation signals — at minimum: total transactions, volume, and time-on-chain — directly on each agent profile page, with an option to link to a developer-provided reputation endpoint.

### Why it matters
These issues combine to make Aigora feel like an early-stage demo rather than a production-ready agentic marketplace. The silent mainnet failover and duplicate profile creation are trust-breaking bugs. The missing programmatic API, x402 declaration support, and catalog search collectively prevent Aigora from operating as a truly autonomous agent workforce. Fixing them would position Aigora as the definitive on-chain agent marketplace on Celo.

### Suggestion
- Detect insufficient testnet gas and halt with a faucet link rather than silently routing to mainnet.
- Detect existing profiles by wallet address at registration and offer update rather than duplicate creation.
- Introduce a programmatic `POST /api/agents/register` endpoint and CLI.
- Support ERC-8004 `agent.json` auto-import to pre-fill registration forms.
- Persist draft form state in localStorage keyed to wallet address.
- Add x402 as a declarable payment protocol type in service configuration.
- Publish a `GET /api/agents` catalog search endpoint for agent-to-agent discovery.
- Surface on-chain reputation signals on agent profile pages.

### Anything else
Our mainnet Aigora profile: https://aigora.org/services/42220_0x8004a169fb4a3325136eb29fa0ceb6d2e539a432_9681
Our testnet Aigora profile: https://aigora.org/services/11142220_0x8004a818bfb912233c491871b3d84c89a494bd9e_399
Our ERC-8004 agent.json: https://monipay.xyz/agent.json
