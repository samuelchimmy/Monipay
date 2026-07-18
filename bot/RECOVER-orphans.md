# Recovering the orphan recipients — brute-force preimage (Telegram only)

The on-chain `recipientId = keccak256("<platform>:<userId>")`. Platform is NOT
on-chain (all bots share relayer 0xdfa5fe22…), and the handles were never saved
(dual-write failure) — so the ONLY recovery is brute-forcing the preimage.
Feasible for Telegram (numeric IDs ≤ ~10 digits); infeasible for Discord/X
(64-bit snowflakes).

## Files
- `orphan-hashes.txt` — the 10 target keccak-256 hashes (no `0x`), one per line.
  Line→IOU:  1=celo#41 2=celo#47 3=celo#50 4=celo#51 5=celo#52 6=celo#53
             7=celo#54 8=celo#55 9=celo#59 10=ink#13

## hashcat (GPU — seconds to minutes)
keccak-256 = hashcat mode 17800. Telegram IDs currently span ~6–10 digits.
Run one mask per length (or use --increment). `-a 3` = mask attack.

```bash
# 10-digit and down, digits only, prefixed with the literal "telegram:"
hashcat -m 17800 -a 3 orphan-hashes.txt "telegram:?d?d?d?d?d?d?d?d?d?d" --increment --increment-min 6
# results:
hashcat -m 17800 orphan-hashes.txt --show
```

Notes:
- hashcat hashes the literal string incl. the `telegram:` prefix — that's exactly
  what the contract does, so a crack yields the full `telegram:<id>` preimage.
- Also try `discord:?d…` ONLY if you believe a recipient used a *legacy short*
  numeric id; modern Discord snowflakes (18–19 digits) are NOT crackable.
- To include usernames instead of ids (some sends used the handle form), run a
  dictionary attack with your wordlist:  `-a 0 orphan-hashes.txt tg_usernames.txt`
  where each line is `telegram:<username>`.

## What to send me back
Paste the `--show` output (the cracked `telegram:<id>` strings). For each, I will:
1. Re-hash and confirm it EXACTLY equals the orphan's on-chain recipientId
   (cryptographic proof, no guessing).
2. Resolve `<id>` → @username via Telegram lookup.
3. Emit the precise backfill UPDATE (platform, platform_user_id, recipient_id,
   recipient_identifier) for that iou.

## If no GPU: JS fallback
A worker-thread brute force on this machine does ~73k h/s/core → ~6h for the full
0–1e10 Telegram range across 4 workers. I can launch it in the background on
request, but hashcat on any GPU is vastly faster.
