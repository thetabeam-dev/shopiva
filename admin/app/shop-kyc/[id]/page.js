import { getPool } from '../../../lib/db';
import Link from 'next/link';
import ReviewActions from './ReviewActions';
import '../../styles/style.css';

export default async function ShopKycReviewPage({ params }) {
  const { id } = await params;
  const shopId = parseInt(id ?? '', 10);
  if (Number.isNaN(shopId)) {
    return (
      <div className="resource-page">
        <h1>Shop KYC Review</h1>
        <p>Invalid shop identifier.</p>
      </div>
    );
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT s.id,
            s.ownerid AS "ownerId",
            CONCAT(u.fname, ' ', u.lname) AS "ownerName",
            u.email AS "ownerEmail",
            u.phone AS "ownerPhone",
            s.name,
            s.status,
            s.isverified AS "isVerified",
            s.location->>'address' AS "shopAddress",
            s.verificationdocuments->'businessLicense'->>'verified' AS "businessLicenseVerified",
            s.verificationdocuments->'businessLicense'->>'url' AS "businessLicenseUrl",
            s.verificationdocuments->'businessLicense'->>'submittedAt' AS "businessLicenseSubmittedAt",
            s.verificationdocuments->'cacDocument'->>'verified' AS "cacDocumentVerified",
            s.verificationdocuments->'cacDocument'->>'url' AS "cacDocumentUrl",
            s.verificationdocuments->'cacDocument'->>'submittedAt' AS "cacDocumentSubmittedAt",
            s.verificationdocuments->'proofOfAddress'->>'verified' AS "proofOfAddressVerified",
            s.verificationdocuments->'proofOfAddress'->>'url' AS "proofOfAddressUrl",
            s.verificationdocuments->'proofOfAddress'->>'submittedAt' AS "proofOfAddressSubmittedAt",
            s.verificationdocuments->'identityProof'->>'verified' AS "identityProofVerified",
            s.verificationdocuments->'identityProof'->>'url' AS "identityProofUrl",
            s.verificationdocuments->'identityProof'->>'submittedAt' AS "identityProofSubmittedAt",
            s.createdat AS "createdAt"
     FROM shops s
     LEFT JOIN users u ON u.id = s.ownerid
     WHERE s.id = $1
     LIMIT 1`,
    [shopId],
  );

  const shop = rows[0];

  if (!shop) {
    return (
      <div className="resource-page">
        <h1>Shop KYC Review</h1>
        <p>Shop not found.</p>
      </div>
    );
  }

  const toVerified = (value) => value === true || value === 'true';
  const registrationUrl = shop.cacDocumentUrl || shop.businessLicenseUrl;
  const registrationVerified = toVerified(shop.cacDocumentVerified) || toVerified(shop.businessLicenseVerified);
  const registrationSubmittedAt = shop.cacDocumentSubmittedAt || shop.businessLicenseSubmittedAt;
  const registrationDocKey = shop.cacDocumentUrl ? 'cacDocument' : 'businessLicense';
  const addressVerified = toVerified(shop.proofOfAddressVerified);
  const idVerified = toVerified(shop.identityProofVerified);
  const shopVerified = toVerified(shop.isVerified);

  return (
    <section className="resource-page review-page">
      <div className="resource-header review-header">
        <div>
          <Link className="back-link" href="/">&larr; Back to dashboard</Link>
          <span className="section-kicker">SHOP VERIFICATION</span>
          <h1>Shop KYC Review</h1>
          <p>Review uploaded business documents, ID verification, and proof of address for {shop.name}.</p>
        </div>
        <div className="review-summary-card">
          <div>
            <span className="summary-label">Shop ID</span>
            <strong>{shop.id}</strong>
          </div>
          <div>
            <span className="summary-label">Shop status</span>
            <span className={`status-pill ${shopVerified ? 'status-verified' : 'status-pending'}`}>
              {shopVerified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <div>
            <span className="summary-label">Address</span>
            <span>{shop.shopAddress || 'Not provided'}</span>
          </div>
        </div>
      </div>

      <div className="review-grid">
        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>Company / CAC Certificate</h2>
              <p className="review-card-subtitle">Business registration or CAC document for shop verification.</p>
            </div>
            <span className={`status-pill ${registrationVerified ? 'status-verified' : 'status-pending'}`}>
              {registrationVerified ? 'Approved' : 'Pending'}
            </span>
          </div>
          <div className="review-card-body">
            <p>Submitted at: {registrationSubmittedAt || 'Not available'}</p>
            {registrationUrl ? (
              <div className="kyc-image-card">
                <a href={registrationUrl} target="_blank" rel="noreferrer">
                  <img className="kyc-image-preview" src={registrationUrl} alt="Company Registration Document" />
                </a>
                <a className="kyc-image-link" href={registrationUrl} target="_blank" rel="noreferrer">
                  View full registration document
                </a>
              </div>
            ) : (
              <p className="empty-note">No CAC or company license file uploaded.</p>
            )}
          </div>
          <ReviewActions shopId={shop.id} docKey={registrationDocKey} />
        </div>

        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>Proof of Address</h2>
              <p className="review-card-subtitle">Shop address verification document.</p>
            </div>
            <span className={`status-pill ${addressVerified ? 'status-verified' : 'status-pending'}`}>
              {addressVerified ? 'Approved' : 'Pending'}
            </span>
          </div>
          <div className="review-card-body">
            <p>Submitted at: {shop.proofOfAddressSubmittedAt || 'Not available'}</p>
            {shop.proofOfAddressUrl ? (
              <div className="kyc-image-card">
                <a href={shop.proofOfAddressUrl} target="_blank" rel="noreferrer">
                  <img className="kyc-image-preview" src={shop.proofOfAddressUrl} alt="Proof of Address" />
                </a>
                <a className="kyc-image-link" href={shop.proofOfAddressUrl} target="_blank" rel="noreferrer">
                  View proof of address
                </a>
              </div>
            ) : (
              <p className="empty-note">No proof-of-address file uploaded.</p>
            )}
          </div>
          <ReviewActions shopId={shop.id} docKey="proofOfAddress" />
        </div>

        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>ID / Identity Proof</h2>
              <p className="review-card-subtitle">Government-issued ID or identity document.</p>
            </div>
            <span className={`status-pill ${idVerified ? 'status-verified' : 'status-pending'}`}>
              {idVerified ? 'Approved' : 'Pending'}
            </span>
          </div>
          <div className="review-card-body">
            <p>Submitted at: {shop.identityProofSubmittedAt || 'Not available'}</p>
            {shop.identityProofUrl ? (
              <div className="kyc-image-card">
                <a href={shop.identityProofUrl} target="_blank" rel="noreferrer">
                  <img className="kyc-image-preview" src={shop.identityProofUrl} alt="Identity Proof" />
                </a>
                <a className="kyc-image-link" href={shop.identityProofUrl} target="_blank" rel="noreferrer">
                  View identity proof
                </a>
              </div>
            ) : (
              <p className="empty-note">No identity document uploaded.</p>
            )}
          </div>
          <ReviewActions shopId={shop.id} docKey="identityProof" />
        </div>
      </div>

      <div className="review-card overall-actions-card">
        <div className="review-card-header">
          <div>
            <h2>Finalize review</h2>
            <p className="review-card-subtitle">Approve this shop for platform verification or reject the entire verification flow.</p>
          </div>
        </div>
        <ReviewActions shopId={shop.id} />
      </div>
    </section>
  );
}
