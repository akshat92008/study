export const dynamic = 'force-static';

export default function TermsOfServicePage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', lineHeight: 1.6, color: '#334155' }}>
      <h1 style={{ fontSize: 32, color: '#0f172a', marginBottom: 20 }}>Terms of Service</h1>
      <p>Last updated: June 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By using this service, you agree to abide by these Terms of Service. If you do not agree, please do not use the product.</p>

      <h2>2. Use of AI Tools</h2>
      <p><strong>Educational Support Only:</strong> The artificial intelligence tools provided are for supplementary educational purposes. They are not a replacement for formal instruction. We do not guarantee passing grades, test scores, or specific outcomes as a result of using our tools.</p>
      
      <h2>3. Acceptable Use and Abuse</h2>
      <p>You agree not to upload abusive, illegal, or copyrighted material you do not have rights to use. We employ rate limiting and abuse prevention mechanisms. Accounts violating these terms may be suspended or deleted without refund.</p>

      <h2>4. Subscriptions & Billing</h2>
      <p>Payments are processed securely via Stripe. Paid subscriptions are billed automatically. Please see our <a href="/refund" style={{ color: '#2563eb' }}>Refund Policy</a> for details on cancellations.</p>
    </main>
  );
}
