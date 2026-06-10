export const dynamic = 'force-static';

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', lineHeight: 1.6, color: '#334155' }}>
      <h1 style={{ fontSize: 32, color: '#0f172a', marginBottom: 20 }}>Privacy Policy</h1>
      <p>Last updated: June 2026</p>

      <h2>1. Information We Collect</h2>
      <p>We collect account information (email, name), usage data, and any materials you upload for learning purposes. We process your data to provide AI-assisted study features.</p>

      <h2>2. Data Usage & AI Limitations</h2>
      <p><strong>IMPORTANT AI DISCLOSURE:</strong> The AI features in this product are designed for educational support only. They do not guarantee exam outcomes, nor are they a substitute for professional instruction. Uploaded materials may be processed by third-party AI providers (e.g., OpenAI) exclusively for generating study aids and not for training foundation models.</p>

      <h2>3. Data Rights & Export</h2>
      <p>You own your learning data. You may request an export of your goals, sessions, flashcards, and material metadata at any time from your account settings. You may also request complete account deletion.</p>

      <h2>4. Cookies & Analytics</h2>
      <p>We use essential cookies for authentication and security. We may also use standard analytics tools to monitor product health and feature usage. By using our service, you consent to these practices.</p>

      <h2>5. Contact Us</h2>
      <p>If you have questions about this privacy policy, please visit our <a href="/support" style={{ color: '#2563eb' }}>Support</a> page.</p>
    </main>
  );
}
