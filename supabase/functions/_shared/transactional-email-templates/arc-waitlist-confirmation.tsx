/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MoniPay'
const ARC_TEAL = '#15839c'
const INK = '#0e2030'
const MUTED = '#5a6b7a'

interface ArcWaitlistConfirmationProps {
  email?: string
}

const ArcWaitlistConfirmationEmail = ({ email }: ArcWaitlistConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the Arc early-access list.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={badge}>
          <Text style={badgeText}>Arc Early Access</Text>
        </Section>

        <Heading style={h1}>You're on the list.</Heading>

        <Text style={lead}>
          Thanks for raising your hand. We'll ping {email ? <strong>{email}</strong> : 'you'} the
          moment {SITE_NAME} opens on Arc, Circle's payment-native L1.
        </Text>

        <Section style={card}>
          <Text style={cardTitle}>What to expect</Text>
          <Text style={cardItem}>· Send USDC by posting on X, Discord, Telegram, or Bluesky.</Text>
          <Text style={cardItem}>· No addresses. No gas. No friction.</Text>
          <Text style={cardItem}>· You'll be in the first batch of invites.</Text>
        </Section>

        <Text style={text}>
          Until then, you can explore {SITE_NAME} on Base, BSC, Solana, and Tempo at{' '}
          <a href="https://monipay.xyz" style={link}>monipay.xyz</a>.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          A Hammer. Not a Dishwasher. — The {SITE_NAME} team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ArcWaitlistConfirmationEmail,
  subject: "You're on the Arc early-access list",
  displayName: 'Arc waitlist confirmation',
  previewData: { email: 'you@example.com' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  color: INK,
}
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const badge = {
  display: 'inline-block',
  backgroundColor: ARC_TEAL,
  borderRadius: '999px',
  padding: '6px 12px',
  marginBottom: '24px',
}
const badgeText = {
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  margin: 0,
}
const h1 = { fontSize: '28px', fontWeight: 800, color: INK, margin: '0 0 16px', lineHeight: 1.2 }
const lead = { fontSize: '15px', color: INK, lineHeight: 1.6, margin: '0 0 24px' }
const text = { fontSize: '14px', color: MUTED, lineHeight: 1.6, margin: '0 0 16px' }
const card = {
  backgroundColor: '#f4f8fa',
  borderRadius: '16px',
  padding: '20px 22px',
  margin: '8px 0 24px',
}
const cardTitle = { fontSize: '13px', fontWeight: 700, color: INK, margin: '0 0 10px' }
const cardItem = { fontSize: '14px', color: INK, lineHeight: 1.6, margin: '4px 0' }
const link = { color: ARC_TEAL, textDecoration: 'none', fontWeight: 600 }
const hr = { borderColor: '#e6ecef', margin: '28px 0 16px' }
const footer = { fontSize: '12px', color: MUTED, margin: 0 }