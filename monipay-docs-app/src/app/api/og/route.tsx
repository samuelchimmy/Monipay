import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'Monipay Documentation';
  const section = searchParams.get('section') || 'Protocol';

  // Note: Vercel OG doesn't support custom local fonts easily without fetching.
  // We'll use the default sans font which defaults to Inter/System.

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#0D0D0D',
          padding: '80px',
          color: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 0L40 20L20 40L0 20L20 0Z" fill="white"/>
            <path d="M20 10L30 20L20 30L10 20L20 10Z" fill="#0D0D0D"/>
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '60px' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 500,
              color: '#0052FF',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '20px',
            }}
          >
            {section}
          </div>
          <h1
            style={{
              fontSize: '84px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              maxWidth: '900px',
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '80px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '18px',
            fontFamily: 'monospace',
            color: '#666',
          }}
        >
          docs.monipay.xyz
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
