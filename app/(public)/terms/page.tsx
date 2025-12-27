import type { Metadata } from 'next'
import PublicLayout from '@/components/public-layout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for BIDI Construction - AI-Powered Construction Estimating & Bid Management Platform',
}

export default function TermsOfServicePage() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-8">Terms of Service</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              By accessing and using BIDI Construction ("BIDI", "we", "us", or "our") services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              BIDI provides an AI-powered construction estimating and automated bid management platform. Our services include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Automated plan analysis and takeoff</li>
              <li>AI-powered cost estimation</li>
              <li>Subcontractor outreach and bid collection</li>
              <li>Bid comparison and leveling tools</li>
              <li>Project management and communication tools</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">3. User Accounts</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To access certain features of our service, you must register for an account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and update your account information to keep it accurate</li>
              <li>Maintain the security of your password and identification</li>
              <li>Accept all responsibility for activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">4. Use of Service</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree to use our service only for lawful purposes and in accordance with these Terms. You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Use the service in any way that violates any applicable federal, state, local, or international law or regulation</li>
              <li>Transmit any malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorized access to our systems or networks</li>
              <li>Interfere with or disrupt the service or servers connected to the service</li>
              <li>Use the service to transmit spam, unsolicited communications, or promotional materials</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">5. Intellectual Property</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The service and its original content, features, and functionality are owned by BIDI and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not modify, reproduce, distribute, create derivative works, publicly display, or otherwise exploit any content from our service without our express written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">6. User Content</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You retain ownership of any content you upload, submit, or transmit through our service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your User Content solely for the purpose of providing and improving our services.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You represent and warrant that you have all necessary rights to grant this license and that your User Content does not violate any third-party rights or applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">7. Payment Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you purchase a subscription or pay-per-use service:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>You agree to pay all fees associated with your account</li>
              <li>Fees are billed in advance on a recurring basis (for subscriptions) or as used (for pay-per-use)</li>
              <li>All fees are non-refundable unless otherwise stated</li>
              <li>We reserve the right to change our pricing with 30 days notice</li>
              <li>Failure to pay may result in suspension or termination of your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">8. Disclaimers</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>The service will be uninterrupted, secure, or error-free</li>
              <li>Defects will be corrected</li>
              <li>The service is free of viruses or other harmful components</li>
              <li>The results obtained from using the service will be accurate or reliable</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our AI-powered estimates and analyses are provided for informational purposes only and should not be the sole basis for construction decisions. Always verify estimates with qualified professionals.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To the maximum extent permitted by law, BIDI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of our service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">10. Indemnification</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              You agree to defend, indemnify, and hold harmless BIDI and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your use of the service or violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">11. Termination</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may terminate or suspend your account and access to the service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last updated" date. Your continued use of the service after such modifications constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">13. Governing Law</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of Utah, United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">14. Contact Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Email:</strong> weston@bidicontracting.com<br />
              <strong>Phone:</strong> 385-216-9587
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}

