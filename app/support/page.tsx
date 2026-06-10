export const dynamic = 'force-static';

export default function SupportPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', lineHeight: 1.6, color: '#334155' }}>
      <h1 style={{ fontSize: 32, color: '#0f172a', marginBottom: 20 }}>Support & Contact</h1>
      
      <h2>1. Get Help</h2>
      <p>If you have questions, encounter a bug, or need assistance using our AI study tools, please reach out to us. We aim to respond to all inquiries within 24-48 hours during business days.</p>

      <h2>2. Account & Data Requests</h2>
      <p>If you need to request a data export, manage your subscription, or request complete account deletion, please use the settings available in your Dashboard or contact support directly if you cannot access your account.</p>

      <h2>3. Contact Information</h2>
      <p>Email us at: <strong>support@cognitionos.app</strong></p>
      
      <p style={{ marginTop: 40, fontSize: 14, color: '#64748b' }}>
        <a href="/terms" style={{ color: '#64748b', marginRight: 15 }}>Terms of Service</a>
        <a href="/privacy" style={{ color: '#64748b', marginRight: 15 }}>Privacy Policy</a>
        <a href="/refund" style={{ color: '#64748b' }}>Refund Policy</a>
      </p>
    </main>
  );
}
