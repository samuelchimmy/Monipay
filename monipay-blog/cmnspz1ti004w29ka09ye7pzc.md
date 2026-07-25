---
title: " Three Things That Could Break Crypto And What We At Monipay Think About Them"
seoTitle: "Satoshi, Quantum, & Mythos: Analyzing a Week of Cryptography"
seoDescription: "Satoshi identity, Quantum risks, and Mythos AI exploits analyze the week's biggest crypto security threats and how Monipay builds for the future."
datePublished: 2026-04-10T09:44:42.488Z
cuid: cmnspz1ti004w29ka09ye7pzc
slug: three-things-that-could-break-crypto-and-what-we-at-monipay-think-about-them
cover: https://cdn.hashnode.com/uploads/covers/6572eb4aa09b3311fdb7ba14/a4ef4c0b-4e7c-4b19-92d9-cb31ee4dfe31.png
ogImage: https://cdn.hashnode.com/uploads/og-images/6572eb4aa09b3311fdb7ba14/ef774cc2-730b-431c-904c-1eba75f3c547.png
tags: quantum-computing, satoshinakamoto, crypto-security, anthropic-mythos, project-glasswing, aes-gcm-vulnerability, quantum-safe-bitcoin, qsb

---

This week gave the crypto industry a lot to sit with.

On April 8, [Anthropic published findings](https://www.anthropic.com) from its newest AI model, [Claude Mythos Preview](https://nxcode.io/claude-mythos-preview-anthropics-most-powerful-ai), showing it had autonomously found and exploited security vulnerabilities in cryptography libraries that had gone undetected for decades. Two days before that, the[New York Times published an investigation](https://www.theblock.co/news/nyt-investigation-suggests-adam-back-may-be-satoshi-nakamoto) pointing to Adam Back, the CEO of Blockstream, as the most likely identity behind Satoshi Nakamoto. [Back denied it](https://www.xt.com/en/news/adam-back-denies-being-satoshi-amid-nyt-probe). And on April 9,[a researcher at StarkWare published a working scheme for quantum-safe Bitcoin transactions](https://cryptonews.net/news/bitcoin/starkware-researcher-publishes-quantum-safe-bitcoin-transaction-scheme/) that requires no changes to the Bitcoin protocol and costs [between $75 and $150 in cloud GPU compute to execute](https://cryptonews.net/news/bitcoin/starkware-researcher-publishes-quantum-safe-bitcoin-transaction-scheme/).

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/pblo4ax72iphp2q979om.png)

Three separate developments. Three different risk categories. All arriving in the same week.

I want to go through each one, explain what I actually think the risk is, and then say honestly what it means for us at Monipay.

* * *

## The Satoshi question

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/okfksfp8l4fvuly6jpmb.png)

The[New York Times investigation, led by John Carreyrou](https://www.pcgamer.com/a-renowned-new-york-times-investigative-reporter-thinks-british-cryptographer-is-bitcoin-creator-satoshi-nakamoto-said-cryptographer-says-no/), points to Adam Back as the most likely candidate based on linguistic analysis, overlapping timelines, and[Back's development of HashCash](https://bitcoinfoundation.org/nyt-names-adam-back-as-most-likely-satoshi-nakamoto/), a proof-of-work system that directly influenced Bitcoin's design. [Back denied the claims in a series of posts on X](https://www.xt.com/en/news/adam-back-denies-being-satoshi-amid-nyt-probe). Blockstream released a statement calling the report "circumstantial interpretation of select details and speculation, not definitive cryptographic proof."

He is probably right about the cryptographic proof part. No one has moved Satoshi's coins. No private key has been demonstrated. Under that standard, nothing is proven.

But the question is worth taking seriously not because of who Satoshi might be, but because of what a confirmed identity would actually do to Bitcoin's market.

Satoshi is estimated to hold around 1.1 million Bitcoin. Even without selling, identifying the owner of those early coins could trigger supply-shock fears and reflexive sell-offs. The concern is not that Satoshi would necessarily liquidate. The concern is that the narrative of a leaderless, no-one-controls-this-thing network would take a direct hit. Bitcoin's monetary premium sits partly on that story.

If Satoshi is identified as a real person or group that looks politically exposed, ethically compromised, or legally vulnerable, Bitcoin's neutrality narrative takes a hit. That does not break the network, but it can reduce the monetary premium that sits on top of the technology.

There is also the legal dimension. A confirmed identity immediately produces a target for civil suits, government investigations, tax authority interest, and sanctions exposure depending on the jurisdiction. None of those things touch the protocol. All of them touch price and institutional confidence.

My read is that the Satoshi identity risk is real but slow-moving and market-level rather than technical. Bitcoin the network would survive the reveal. Bitcoin the asset would likely experience significant volatility, then stabilise once it became clear that nothing about the protocol had changed. The deeper risk is if the revealed person is someone whose background calls the origin story into genuine question, which would require an extraordinary fact pattern, not just someone being a cryptographer who kept quiet.

For stablecoins and for Monipay specifically, a Bitcoin confidence shock matters indirectly. It would move the entire crypto market, and market confidence affects how comfortable people are holding and spending USDC or USDT. But USDC and USDT do not depend on Bitcoin's narrative the way BTC price does. The payments infrastructure we are building would keep functioning regardless of who Satoshi turns out to be.

* * *

## The quantum threat, which is no longer theoretical
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/dlfzghxo4en0dfgbu96y.png)
The quantum risk to Bitcoin has been discussed for years as a future problem. This week it became a present engineering problem.

On April 9,[Avihu Mordechai Levy of StarkWare published a paper titled "Quantum-Safe Bitcoin Transactions Without Softforks."](https://cryptorank.io/news/bitcoin-could-be-quantum-safe-without-protocol-changes-new-proposal-claims) The abstract describes [QSB, a quantum-safe Bitcoin transaction scheme](https://www.criptonoticias.com/tecnologia/presentan-una-forma-de-blindar-bitcoin-contra-la-cuantica-hoy-y-no-requiere-un-softfork/) that requires no changes to the Bitcoin protocol and remains secure even against an adversary running Shor's algorithm. The scheme works within Bitcoin's existing legacy script constraints of 201 opcodes and 10,000 bytes.

The core of the approach is a hash-to-signature puzzle. Standard Bitcoin transactions rely on ECDSA signatures over the secp256k1 curve. Shor's algorithm can efficiently compute discrete logarithms, which would let a quantum adversary forge those signatures. QSB replaces ECDSA security with RIPEMD-160 pre-image resistance. The locking script hashes a transaction-bound public key via OP\_RIPEMD160 and interprets the 20-byte output as a DER-encoded ECDSA signature. A random 20-byte string satisfies DER structural constraints with probability approximately 2^-46, providing the proof-of-work target. A quantum computer cannot break this because the hardness comes from hash pre-image resistance, not elliptic curve arithmetic.

The practical cost is [$75 to $150 in cloud GPU compute](https://cryptonews.net/news/bitcoin/starkware-researcher-publishes-quantum-safe-bitcoin-transaction-scheme/), using CUDA code that achieves 238 million operations per second on an RTX PRO 6000. The GitHub repository includes working code, documented benchmarks, and a confirmed DER hit on real hardware after six hours on eight GPUs.

The same week,[Olaoluwa Osuntokun posted to the Bitcoin Development Mailing List a proposal](https://www.bitget.com/news/detail/lightning-labs-cto-releases-zk-stark-prototype-quantum-rescue-tool) for[Post-Quantum BIP-86 Recovery via zk-STARK proof of BIP-32 seed knowledge](https://gnusha.org/pi/bitcoindev/)

. The proposal enables a Taproot output public key holder to prove, using a zero-knowledge STARK proof, that their key was derived from a known BIP-32 seed via a BIP-86 path, without revealing the seed itself. This addresses how existing Bitcoin holders would migrate to quantum-safe outputs without losing access to their coins.

What these two papers together mean is that serious cryptographers are no longer treating quantum-resistant Bitcoin as a theoretical exercise. They are shipping working implementations.

The important distinction here is between the threat to Bitcoin specifically and the threat to the broader cryptographic infrastructure that crypto runs on. ECDSA is the mechanism under attack from Shor's algorithm. Ethereum and most EVM-compatible chains use the same secp256k1 curve. Solana uses Ed25519, which has different but related quantum exposure. None of the major blockchain ecosystems are immune.

The timeline matters. Cryptographers generally agree that a quantum computer capable of running Shor's algorithm at the scale needed to break secp256k1 keys requires millions of logical qubits with very low error rates. Current quantum computers have hundreds to thousands of noisy physical qubits. The engineering gap between where we are and where an attacker would need to be is still significant. But the history of cryptography shows that you prepare migration paths before the attack arrives, not after.

The QSB work from StarkWare is not a production-ready migration path for the entire Bitcoin ecosystem. It is a proof-of-concept that shows the migration can be done within existing constraints. That is meaningful. It moves the conversation from "quantum is a future problem" to "here is one way to handle it when the time comes."

For Monipay, the quantum question touches us at the signature layer. Our EIP-712 gasless relayer uses ECDSA. Our MoniBot smart contracts use ECDSA. Our user wallets use secp256k1 keys. None of this is more or less exposed than any other EVM product. We are not doing anything that makes us specifically more vulnerable. But we are also not yet doing anything that makes us specifically more resistant. That is something we are watching carefully as the ecosystem develops post-quantum signature standards.

* * *

## The Mythos threat, which is different from the others

![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/2v9yvasazc3l1ezjcc98.png)

The first two threats are about Bitcoin specifically or about the underlying cryptographic primitives. The Mythos threat is about everything.

Anthropic's Claude Mythos Preview can autonomously identify zero-day vulnerabilities and then construct working exploits across every major operating system and major web browser.[Anthropic's security research team published a technical assessment of Mythos Preview's capabilities on April 7](https://www.anthropic.com), documenting findings from roughly a month of internal testing.

Beyond memory corruption bugs, the model identified authentication bypasses in web applications, weaknesses in widely used cryptography libraries covering TLS, AES-GCM, and SSH, and a guest-to-host memory corruption vulnerability in a production virtual machine monitor.

Mythos Preview identified a number of weaknesses in the world's most popular cryptography libraries, in algorithms and protocols like TLS, AES-GCM, and SSH. These bugs arise due to oversights in the respective algorithms' implementation that allows an attacker to, for example, forge certificates or decrypt encrypted communications.

The AES-GCM finding is the one that matters most directly for crypto infrastructure. AES-GCM is not the same as the elliptic curve cryptography that secures Bitcoin addresses. AES-GCM is the symmetric encryption scheme used in TLS, which secures the HTTPS connections that Monipay's backend, Supabase, and virtually every crypto platform's API layer depends on. A vulnerability in AES-GCM implementations, not in the algorithm itself but in how major libraries implement it, is not a theoretical future risk. It is the kind of thing that, if exploited before patches are deployed, could let an attacker intercept and decrypt communications between a user's device and a payment API.

The critical word in that last sentence is "if exploited before patches are deployed." [Anthropic launched Project Glasswing](https://medium.com/@Mustafa_Genc/project-glasswing-and-claude-mythos-preview-anthropics-bet-on-ai-powered-cyber-defense-apr-2026-medium) alongside the model, a defensive coalition including[Amazon Web Services, Apple, Broadcom, Cisco, CrowdStrike, Google, JPMorganChase, the Linux Foundation, Microsoft, NVIDIA, and Palo Alto Networks](https://www.anthropic.com), formed to use these capabilities to secure critical software before similar models become widely available.

The notable absence in that list is any crypto company. No exchange. No blockchain infrastructure provider. No DeFi protocol. No payment platform. The coalition Anthropic assembled to use Mythos defensively before similar capabilities become widely available is composed entirely of traditional software and enterprise infrastructure companies.

The risk is particularly high for DeFi protocols, which are open source software. Their code is publicly readable by anyone, including a model like Mythos that can autonomously catalog every weakness in a codebase at machine speed for near-zero marginal cost. And while the roughly $200 billion locked in smart contracts across Ethereum, Solana, and other chains has been audited by humans and automated scanners, Anthropic claims Mythos operates beyond both.

The company noted that "mitigations whose security value comes primarily from friction rather than hard barriers may become considerably weaker against model-assisted adversaries." Multisig governance, timelocks, and audit reports as proof of security are all friction-based defenses. In simple terms, these measures slow things rather than blocking an attack at the code level.

This is the argument that matters. The security model that most of DeFi runs on assumes a human attacker with limited time and cost. Finding an exploit in a mature codebase takes weeks or months and requires rare expertise. That cost assumption is what makes bounties and audits functional. If Mythos-class models can find and exploit vulnerabilities autonomously at near-zero marginal cost, the entire cost model of DeFi security changes.

That does not mean every DeFi protocol is about to be drained. It means the industry needs to take the next generation of security tooling seriously much faster than it currently is.

At Monipay, the Mythos findings reinforced something we already built around: non-custodial architecture. Our user private keys are generated on-device, encrypted with AES-GCM using PBKDF2 key derivation from the user's PIN, and stored in hardware-backed secure storage. We never receive them. We cannot transmit them. An attacker who finds an implementation flaw in our API layer cannot use it to extract private keys, because we do not have private keys to extract.

The AES-GCM vulnerability found by Mythos is in the TLS implementation layer, which affects HTTPS communications. This is a real concern for any product that transmits sensitive data over the network. For us specifically, it means keeping our dependencies current, watching the Glasswing disclosure timeline for patches, and treating any CVE in our cryptographic dependency chain as urgent rather than scheduled. Two of the three AES-GCM vulnerabilities Mythos found were unpatched at time of disclosure. One was patched the same day. The practical window between "Mythos finds it" and "the fix ships" is now the attack surface.

The deeper concern is what happens when models with Mythos-class capabilities are not limited to a coalition of 40 companies. Anthropic states that these capabilities were not explicitly trained for, but emerged as a downstream consequence of general improvements in code understanding, reasoning, and autonomy. [The company does not plan to make Mythos Preview generally available.](https://nxcode.io/claude-mythos-preview-anthropics-most-powerful-ai) That is today's position. It will not be the position indefinitely. The security community has roughly twelve to eighteen months to build its defenses before comparable capabilities are widely accessible, which is the same logic that drove Glasswing's formation.

* * *

## What we take from all three

The threats are different in nature and in timeline.

The Satoshi reveal is mostly a confidence and market risk. If it happens in a way that damages the neutrality narrative around Bitcoin, it affects market sentiment broadly. The protocol keeps running. The payments infrastructure keeps working. We would see volatility and then adaptation.

The quantum threat is a long-horizon cryptographic risk that is now generating real engineering responses. The[QSB paper from StarkWare](https://cryptorank.io/news/bitcoin-could-be-quantum-safe-without-protocol-changes-new-proposal-claims) and the[BIP-86 zk-STARK proposal from Osuntokun](https://www.bitget.com/news/detail/lightning-labs-cto-releases-zk-stark-prototype-quantum-rescue-tool) show that the Bitcoin development community is actively building migration paths, not waiting. The EVM ecosystem will need equivalent work. We are watching it and planning for the day when post-quantum signatures become a production requirement rather than a research interest.

The Mythos threat is the one on the shortest timeline and the broadest surface area. It is not specific to Bitcoin. It is not specific to crypto. It is a capability shift in how vulnerabilities are found and exploited that affects every software system in production, including the ones crypto runs on top of. The fact that no crypto company is in Glasswing is something the industry should notice.

None of these three things break stablecoins as a concept. The value of moving dollars at near-zero cost in near-zero time across borders does not go away because of any of them. The infrastructure those movements run on top of needs to keep pace with the threats. That is what we are building toward.

* * *

*Monipay is a non-custodial stablecoin payment platform live on Base and BSC. moniTag™ replaces wallet addresses. MoniBot AI executes on-chain payments from a single tweet. monipay.xyz*

* * *