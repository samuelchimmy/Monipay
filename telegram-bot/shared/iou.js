const CREATE_MAGIC_PAY_URL = `${process.env.SUPABASE_URL}/functions/v1/create-iou`;

export async function createMagicPayRecord({
  senderProfileId,
  senderPayTag,
  senderHandle,
  senderPlatformUserId,
  recipientUsername,
  platform = 'telegram',
  platformUserId,
  amount,
  chain,
  token,
  tokenSymbol,
  txHash,
  iouId,
  expiry,
}) {
  try {
    const resp = await fetch(CREATE_MAGIC_PAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        senderProfileId,
        senderPayTag,
        senderHandle,
        senderPlatformUserId,
        recipientIdentifier: `${platform}:${recipientUsername || platformUserId}`,
        platform,
        platformUserId,
        amount,
        chain,
        token,
        tokenSymbol,
        iouId,
        txHash,
        expiry: expiry || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const data = await resp.json();
    if (!resp.ok) return null;
    return data.iou;
  } catch {
    return null;
  }
}
