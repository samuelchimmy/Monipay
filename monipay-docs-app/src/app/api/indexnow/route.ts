import { NextResponse } from 'next/server';

export async function GET() {
  const host = 'docs.monipay.xyz';
  const keyLocation = `https://${host}/.well-known/c0b628b5e40742f48f430567c9c0f05e.txt`;
  
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host,
        key: 'c0b628b5e40742f48f430567c9c0f05e', // using a fake example key
        keyLocation,
        urlList: [
          `https://${host}/`,
        ],
      }),
    });

    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Pinged IndexNow successfully' });
    }
    
    return NextResponse.json({ success: false, message: 'Failed to ping IndexNow' }, { status: res.status });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Error pinging IndexNow', error }, { status: 500 });
  }
}
