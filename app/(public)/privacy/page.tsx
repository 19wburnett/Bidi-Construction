import type { Metadata } from 'next'
import PublicLayout from '@/components/public-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for BIDI Construction - AI-Powered Construction Estimating & Bid Management Platform',
}

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-8">Privacy Policy</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">1. Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              BIDI Construction ("BIDI", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered construction estimating and bid management platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">2.1 Information You Provide</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, company name, and password</li>
              <li><strong>Profile Information:</strong> Job title, business address, and other professional details</li>
              <li><strong>Project Data:</strong> Construction plans, project details, estimates, bids, and related documents</li>
              <li><strong>Subcontractor Information:</strong> Contact details, specialties, and performance data</li>
              <li><strong>Payment Information:</strong> Billing address and payment method details (processed securely through third-party payment processors)</li>
              <li><strong>Communications:</strong> Messages, emails, and other communications sent through our platform</li>
            </ul>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">2.2 Automatically Collected Information</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">When you use our service, we automatically collect:</p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
              <li><strong>Log Data:</strong> Access times, error logs, and system performance data</li>
              <li><strong>Cookies and Tracking:</strong> We use cookies and similar technologies to enhance your experience</li>
            </ul>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">2.3 Google User Data</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you choose to sign in using Google OAuth, we access the following information from your Google account:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li><strong>Basic Profile Information:</strong> Your name and email address</li>
              <li><strong>Profile Picture:</strong> Your Google profile picture (if available)</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Important:</strong> We do not access, read, or store any data from your Gmail account. All email functionality in our application is handled through Resend, a third-party email service provider. We do not use the Gmail API or access any Gmail messages, attachments, or other Gmail data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Personalize your experience and provide relevant content</li>
              <li>Send marketing communications (with your consent)</li>
              <li>Comply with legal obligations and enforce our terms</li>
            </ul>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">3.1 How We Use Google User Data</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Google user data accessed through OAuth authentication is used solely for the following purposes:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li><strong>Account Creation and Authentication:</strong> To create and authenticate your user account on our platform</li>
              <li><strong>Profile Setup:</strong> To pre-populate your profile with your name and email address from your Google account</li>
              <li><strong>Account Management:</strong> To identify you when you sign in and maintain your account information</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Data Storage:</strong> The Google user data we access (name, email, profile picture) is stored securely in our database and is subject to the same security measures and retention policies as other user data described in this Privacy Policy.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Data Sharing:</strong> We do not share Google user data with third parties except as described in Section 4 (How We Share Your Information). We do not use Google user data for advertising purposes or transfer it to third parties for their use.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Data Access Limitations:</strong> We only access the minimum Google user data necessary to provide authentication services. We do not request or access any additional Google user data beyond basic profile information (name, email, profile picture).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">4. How We Share Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">We may share your information in the following circumstances:</p>
            
            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">4.1 Service Providers</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We share information with third-party service providers who perform services on our behalf, such as:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Cloud hosting and data storage providers</li>
              <li>Payment processors</li>
              <li>Email and communication service providers</li>
              <li>Analytics and performance monitoring services</li>
              <li>AI and machine learning service providers</li>
            </ul>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">4.2 Business Transfers</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If we are involved in a merger, acquisition, or asset sale, your information may be transferred as part of that transaction.
            </p>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">4.3 Legal Requirements</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may disclose your information if required to do so by law or in response to valid requests by public authorities.
            </p>

            <h3 className="text-xl font-semibold text-black dark:text-white mt-6 mb-3">4.4 With Your Consent</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may share your information with your consent or at your direction, such as when you share project information with subcontractors.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">5. Data Security</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure data centers and infrastructure</li>
              <li>Employee training on data security practices</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">6. Your Rights and Choices</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">You have certain rights regarding your personal information:</p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4 space-y-2">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Request transfer of your data to another service</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Cookie Preferences:</strong> Manage cookie settings through your browser</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              To exercise these rights, please contact us at weston@bidicontracting.com.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">7. Data Retention</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We retain your information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">8. Children's Privacy</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">9. International Data Transfers</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using our service, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">10. California Privacy Rights</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information (we do not sell personal information).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-black dark:text-white mt-8 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              <strong>Email:</strong> weston@bidicontracting.com<br />
              <strong>Phone:</strong> 385-216-9587<br />
              <strong>Address:</strong> BIDI Construction, United States
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}

