export const dynamic = 'force-static';

export default function RefundPolicyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', lineHeight: 1.6, color: '#334155' }}>
      <h1 style={{ fontSize: 32, color: '#0f172a', marginBottom: 20 }}>Refund & Cancellation Policy</h1>
      
      <h2>1. Cancellations</h2>
      <p>You may cancel your subscription at any time via the Customer Portal accessible from your account settings. Upon cancellation, you will retain access to your paid features until the end of your current billing cycle.</p>

      <h2>2. Refunds</h2>
      <p>Due to the substantial computing costs associated with AI processing (LLM inference, embeddings, and document processing), we generally do not offer refunds for partial subscription periods or unused time. However, if you experience significant technical issues or billing errors, please contact Support within 7 days of the charge.</p>

      <h2>3. Account Deletion</h2>
      <p>Requesting account deletion will immediately terminate your subscription and remove all your data. This action is irreversible, and no prorated refund will be provided for the remaining days in your billing cycle.</p>
    </main>
  );
}
