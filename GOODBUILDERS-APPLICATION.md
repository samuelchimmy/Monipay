# GoodBuilders Season 4 Application — MoniPay

This document contains the official application draft for MoniPay to apply for the GoodBuilders Season 4 continuous funding round on Celo. You can copy and paste these fields directly into the Flow State application form.

---

## Project Information

- **Project Name\***: MoniPay
- **Manager Addresses\***: `0xfa2B8eD012f756E22E780B772d604af4575d5fcf`
- **Description\***:
  MoniPay is an AI-powered social payments and intent execution protocol for stablecoins on Celo, designed to run natively inside Celo’s MiniPay mobile miniapp. It bridges social identities (X, Telegram, Discord) with on-chain actions, allowing users to transact using simple usernames (MoniTags) and natural language commands.
  
  For GoodBuilders Season 4, we are integrating GoodDollar (G$) to unlock real-world utility for UBI recipients. MoniPay will allow:
  1. **Multilevel Financial Intent Execution via AI**: MoniBot (our registered ERC-8004 AI Agent) will support G$ transfers. Users can execute multilevel financial intents (P2P transfers, automated group drops, conditional claims, and scheduled payments) on social channels (X, Telegram, Discord) using natural language commands.
  2. **Superfluid G$ Subscriptions**: Leveraging Superfluid streaming capabilities to support recurring subscription payments in G$ for online creators, communities, and digital services.
  3. **Conversational Merchant Spendability**: G$ will be added as a native payment option across our checkout suite (storefront products, online invoices, and point-of-sale checkouts) to enable UBI recipients to spend G$ directly for daily goods and services.
  
  MoniPay is fully non-custodial (private keys are client-side encrypted via user PIN in the local enclave) and offers a gasless-feel experience by sponsoring gas fees through paymasters on Celo.
- **Logo\***: [Please upload the logo from `src/assets/monipay-m-logo.png` (1:1 ratio)]
- **Banner\***: `monipay-banner.png` (Generated and committed in the repository root)
- **Website\***: `https://monipay.xyz`
- **Demo URL**: `https://monipay.xyz/minipay` *(Please open inside Celo MiniPay Dev Mode)*
- **X/Twitter**: `https://x.com/monipay_xyz`
- **Farcaster**: 
- **Telegram**: `https://t.me/monipay_xyz`
- **Discord**: `https://discord.gg/kSAwXzeRDB`
- **GitHub Repos\***: `https://github.com/samuelchimmy/paytag-duo-flow`
- **Smart Contracts**: 
  - `MoniPayRouter` (Celo Mainnet): `0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0`
  - `MoniBotRouter` (Celo Mainnet): `0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e`
  - `MagicPayIOURegistry` (Celo Mainnet): `0x6bB3C64C382fcF8fB65b24234C455bB62b155742`
- **Wallet to receive funding\***: `0xfa2B8eD012f756E22E780B772d604af4575d5fcf`

---

## Round Questions

### 1. Previous Participation

- **1.1. Have you participated in GoodBuilders before?\***: No (false)
- **1.2. Number of seasons**: 0
- **1.3. Previous Karma Updates if available**: N/A
- **1.4. What's the current state of your project today?\***:
  *Progress made:* MoniPay is built as a multi-entry payment gateway and is optimized for MiniPay (Celo). We have successfully deployed our mainnet routing contracts on Celo, fully operational social account linking (X, Discord, Telegram), non-custodial local key generation, and paymaster gas sponsorship.
  *Milestones completed:* We have completed setup of MoniTag registration, EIP-712 transaction signing, Point-of-Sale checkouts, online invoicing, custom merchant storefronts, and our autonomous AI agent MoniBot is registered as an ERC-8004 trustless agent on Celo.
  *Blockers:* None at this stage; we have successfully tested stablecoin routing on Celo mainnet.
  *What we've been up to:* We are optimizing transaction speeds, adding robust consensus layers (like a 3-source consensus sports oracle for conditional sports-prediction execution), and preparing for G$ integration.

### 2. Maturity & Usage

- **2.1. Project Stage\***: Live product
- **2.2. Lifetime Users (0 is valid if you're early)\***: 150
- **2.3. Active Users\***: 35
- **2.4. Active Users Frequency\***: Weekly Active Users
- **2.5. Other relevant usage data (if available)**:
  Over the past 3 months building in the Celo ecosystem, we have achieved the following milestones:
  - **Celo Proof of Ship progression**: Climbed from 76th place in April 2026 to 59th in May, and reached **32nd place** in June 2026.
  - **AI Track Winner**: Won the AI Track in the May Proof of Ship round (out of 32 AI-focused projects), which saw over 26,000 transactions over 90 days.
  - **3rd Place in Celo Onchain Agents Hackathon**: Placed 3rd out of 73 competitive projects on June 19th, 2026, validating our social intent execution agent (MoniBot), MagicPay escrowless claims, and ERC-8004 identity layers.
  - **StartupBank 2.0 Acceptance**: Accepted into the Deverse Labs StartupBank 2.0 incubation program for growth support.
  - **MiniPay Developer Beta**: Live inside the MiniPay browser ecosystem for emerging markets mobile testing.
  - **Hackathon & Beta Metrics**: Registered 200+ MoniTags, processed hundreds of mainnet Celo transactions, and had 50+ merchants test our mobile Point-of-Sale interface.

### 3. Integration

- **3.1. G$ Integration Status\***: Ready soon
- **3.2. Integration Type\***: (Select the following multi-select options)
  - [x] Payments/rewards using G$
  - [x] G$ Supertoken/streaming
- **3.3. Describe your G$ integration & why it matters (1-3 sentences)\***:
  MoniPay integrates G$ on Celo to allow local merchants to accept G$ directly for invoices, products, and Point-of-Sale checkouts, alongside enabling multilevel financial intent execution (P2P transfers, scheduled payments, and community campaigns) in G$ via X and Telegram using our AI agent. This matters because it provides immediate, real-world utility for GoodDollar UBI recipients to spend their G$ in daily social commerce, creating a complete circular economy on Celo.

### 4. What you'll build

- **4.1. Primary Build Goal (1 sentence)\***:
  Integrate G$ token support into the MoniBot multilevel financial intent execution agent, Superfluid subscription streams, and supportive checkout flows on Celo.
- **4.2. Build Milestones\***:
  *Milestone 1: G$ Asset Configuration*
  - Description: Add Celo G$ contract token mapping to configurations and deploy any routing updates.
  - Deliverable: Supported networks configuration updated in chains.ts, rendering G$ balances on Celo.
  
  *Milestone 2: AI Agent Support*
  - Description: Teach MoniBot (the AI agent) to recognize G$ financial intent commands (e.g., P2P sends, escrow creations, and subscription triggers) and execute them on social media.
  - Deliverable: MoniBot executes multilevel financial intents in G$ on Celo mainnet.
  
  *Milestone 3: Superfluid G$ Streams*
  - Description: Integrate Superfluid's G$ Supertoken support for real-time subscription streams.
  - Deliverable: Subscription modules allow recurring payments in G$.
  
  *Milestone 4: Conversational Merchant & Checkout Flows*
  - Description: Implement G$ payment options on the merchant Point-of-Sale checkouts, invoice pages, and public storefront products.
  - Deliverable: Storefront checkouts allow payments via G$ ERC-20 routing.
- **4.3. Ecosystem Impact (1-2 sentences)**:
  By integrating G$ directly into social intent execution agents and subscription streams, we unlock real-world agentic commerce utility for universal basic income. This increases G$ velocity, token flow, and daily active transactions inside Celo's mobile ecosystem.

### 5. How you'll grow

- **5.1. Primary Growth Goal (1 sentence)\***:
  Onboard 1,000+ active users executing G$ financial intents via MoniBot on social platforms and at least 15 daily active micro-merchants accepting G$ payments via our POS and storefront suite on Celo.
- **5.2. Target Users, Communities, and/or Partners\***:
  We will target active GoodDollar communities, Telegram & Discord builder groups, online creators/DAOs, and local mini-merchants in emerging markets (primarily Nigeria/Kenya) looking for easy-to-use stablecoin POS tools.
- **5.3. Growth Milestones\***:
  *Milestone 1: AI Integration & Bot Activation*
  - Description: Deploy MoniBot with full G$ support to 25+ prominent Celo and GoodDollar-aligned Telegram groups and Discord servers.
  - Activations: Group setups, custom triggers, and bot onboarding tutorials for community managers.
  
  *Milestone 2: Conversational POS & Merchant Onboarding*
  - Description: Partner with local Celo/GoodDollar user groups in Nigeria to onboard the first 10 micro-merchants accepting G$ via our POS/storefronts.
  - Activations: POS terminal setup, merchant store generation, and QR code placement.
  
  *Milestone 3: AI Social Intent Activation*
  - Description: Run a 2-week social intent activation campaign on X using MoniBot to distribute G$ rewards through interactive and conditional commands.
  - Activations: Multi-level intent triggers, community distributions, and viral social campaigns.
- **5.4. Ecosystem Impact (1-2 sentences)**:
  AI-agent-driven social payments combined with conversational POS tools enable UBI recipients to both transact inside their online communities and spend their G$ directly for daily real-world goods. This creates a circular token economy on Celo, increasing G$ utility, velocity, and transaction count.

### 6. Team

- **6.1. Primary Contact Name\***: Samuel Chi
- **6.2. Primary Contact Role Description\***: Lead Developer & Architect
- **6.3. Primary Contact Telegram**: `@samuelchimmy`
- **6.4. Primary Contact GitHub or LinkedIn**: `https://github.com/samuelchimmy`
- **6.5. Additional Teammates**: Solo Builder

### 7. Additional

- **7.1. Additional comments**: We are extremely excited to connect the dots between AI agents, merchant commerce, and universal basic income (UBI) on Celo.
- **7.2. How did you hear about GoodBuilders?**: (Select the following multi-select options)
  - [x] GoodDollar Telegram
  - [x] Partner Organization (Celo Builders network)

---

## Attestation

### 1. Commitment
- **1.1. Agreement to commitment rules\***: Yes (true)

### 2. Identity & KYC
- **2.1. Recipient Type\***: Individual
- **2.2. Legal Name / Company Name\***: Samuel Chi
- **2.3. Country of residence / registration\***: Nigeria
- **2.4. Address\***: [Please enter your address]
- **2.5. Contact Email\***: `support@monipay.xyz`

### 3. Data Acknowledgement
- **3.1. Consent to data collection\***: Yes (true)

### 4. Privacy & Transparency
- **4.1. Agreement to transparency terms\***: Yes (true)

---

## ROUND: GoodBuilders Season 4 Program Details & Eligibility Reference

Below is the eligibility, program rules, timeline, and general reference information provided for GoodBuilders Season 4 (Distributing G$ on Celo).

### Program Overview
GoodBuilders is GoodDollar's builder program — a 3-month continuous funding round for projects and teams creating meaningful products that drive G$ usage, adoption, and ecosystem growth on Celo.
* **Reward Pool**: Season 4 streams $50K USD in G$ via GoodDollar's native Superfluid capabilities, run in partnership with Flow State.
* **Timeline**:
  * Applications Open: June 9th, 2026.
  * Applications Close: June 30th, 2026.
  * Streaming Starts: June 23rd, 2026 (Continuous allocation).
  * Program Duration: ~3 months.
* **Support Channels**: Join the GoodDollar Telegram builder group for mentorship and support.

### Eligibility Criteria
To qualify, a project must commit to:
1. A live G$ integration before or at the start of the season.
2. Delivering real, measurable value to users and the Celo/GoodDollar ecosystem.
3. Growing the GoodDollar ecosystem during the 12-week cycle.

Eligible projects must integrate G$ in at least one of the following ways:
* Provide rewards, services, or subscriptions using the G$ token.
* Implement the face-verification flow with a claim button.
* Use the G$ Identity SDK in a meaningful way.
* Integrate with GoodCollective reward pools (climate action, UBI, or community rewards).
* Leverage G$ Supertoken / streaming capabilities.
* Contribute to the UBI Pool through activity-based fees.
* *Note: Trivial integrations (e.g. basic "accept G$" without added functionality) will not qualify.*

### How Funding is Allocated
Each project's share of the continuous funding stream is determined by a balanced voting signal:
* **25%**: Community voting by unique verified citizens and donors.
* **50%**: Mentor voting.
* **25%**: Growth & progress metrics.
Funding flows continuously, and a project's share can increase or decrease over time based on performance signals.

### Rules & Commitments
* Participants must pass KYC.
* Participants must present their progress on Demo Days and post updates. Projects that fail to do so risk losing votes or getting disqualified.
* Projects must introduce new and innovative features or value.
* Projects must be open-source. Code remains the team's intellectual property.
* Apps and contracts will undergo security and code reviews.
