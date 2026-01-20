export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-serif font-bold text-gray-900 mb-2">
          Day Pass & Camping Pass Terms and Conditions
        </h1>
        
        <p className="text-gray-500 mb-6">
          These Terms and Conditions apply to all Day Pass and Camping Pass purchases
          for entry to Griffith Boat Club facilities.
        </p>

        <section className="space-y-6 text-gray-700 text-sm md:text-base leading-relaxed">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. General</h2>
            <p>
              By purchasing and using a Day Pass or Camping Pass, you agree to comply with
              these Terms and Conditions, as well as all Griffith Boat Club rules, signage,
              and directions provided by staff.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Payment & Pass Issuance</h2>
            <p className="mb-2">
              All passes must be paid for in full prior to entry. Successful payment
              enables the associated PIN code and grants conditional access to the site.
            </p>
            <p className="mb-2">
              Upon purchase, a copy of the pass and access details will be sent to the
              nominated email address provided at checkout.
            </p>
            <p>
              Passes are non-transferable and non-refundable unless required by law.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Day Pass Conditions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Day Pass provides <strong>single-use entry</strong> through the Boat Club gate.</li>
              <li>Entry is granted via a one-time PIN code issued after payment.</li>
              <li>Once used, the PIN becomes invalid and cannot be reused.</li>
              <li>Day Pass access is valid only for the date of issue.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Camping Pass Conditions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Camping Pass provides a <strong>multi-use entry PIN</strong> for the duration of the approved camping stay.</li>
              <li>The PIN remains valid until <strong>10:00 AM on the day of departure</strong>.</li>
              <li>The Camping Pass and associated email confirmation must be kept available, as they may be required to confirm camping entitlement during the stay.</li>
              <li>Camping access is valid only for the dates specified at the time of purchase.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Gate Access & Usage</h2>
            <p className="mb-2">
              To gain entry, users must enter their issued PIN code followed by the
              <strong> #</strong> key at the gate keypad.
            </p>
            <p>
              PIN codes must not be shared with unauthorised persons. Misuse may result in
              access being revoked without refund.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Monitoring & Access Records</h2>
            <p>
              All gate access interactions and pass usage may be logged and monitored for
              security, compliance, and operational purposes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Compliance & Conduct</h2>
            <p className="mb-2">
              All visitors must comply with Griffith Boat Club rules, local regulations,
              and any reasonable directions from staff or authorised representatives.
            </p>
            <p>
              Griffith Boat Club reserves the right to deny or revoke access for misuse of
              passes, breach of conditions, or unsafe or inappropriate behaviour.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Risk & Liability</h2>
            <p className="mb-2">
              Entry to and use of Griffith Boat Club facilities is at the visitor's own risk.
              To the extent permitted by law, Griffith Boat Club is not liable for any loss,
              damage, injury, or death arising from the use of the facilities.
            </p>
            <p className="mb-2">
              This includes, but is not limited to, risks associated with vehicle movement,
              water and boating activities, environmental conditions, camping activities,
              and the use of shared facilities.
            </p>
            <p>
              Visitors are responsible for their own safety and the safety of any accompanying
              guests, vehicles, vessels, and personal equipment while on site.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Assistance & Contact</h2>
            <p>
              If you experience any issues with access or your pass, please contact
              Griffith Boat Club on <strong>(02) 6963 4847</strong> or via email at{" "}
              <a href="mailto:griffithboatclub@gmail.com" className="text-blue-600 hover:underline">
                griffithboatclub@gmail.com
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Access Technology Provider (Zezamii)</h2>
            <p className="mb-2">
              Access control, PIN code issuance, and pass management services for Griffith
              Boat Club are provided using technology supplied by Zezamii.
            </p>
            <p className="mb-2">
              Zezamii provides access management technology only and does not own, operate,
              manage, or supervise Griffith Boat Club facilities or activities.
            </p>
            <p className="mb-2">
              Zezamii does not control on-site conditions, safety, conduct, compliance, or
              the operation of the premises.
            </p>
            <p className="mb-2">
              Access services may be affected by power outages, network connectivity,
              hardware faults, environmental conditions, or third-party service disruptions.
              Zezamii does not guarantee uninterrupted or error-free access operation.
            </p>
            <p className="mb-2">
              To the extent permitted by law, Zezamii is not liable for any loss, damage,
              delay, cost, or inconvenience arising from the use of, or inability to use,
              access credentials or access systems.
            </p>
            <p>
              Access interactions and system activity may be logged for security,
              operational, and audit purposes in accordance with applicable privacy laws.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Amendments</h2>
            <p>
              Griffith Boat Club reserves the right to amend these Terms and Conditions at
              any time. Updated terms will be published on the Club's website.
            </p>
          </div>
        </section>

        <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
          <p>Griffith Boat Club</p>
          <p>Lake Wyangan, NSW</p>
        </div>
      </div>
    </main>
  )
}
