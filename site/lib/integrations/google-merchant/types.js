/**
 * @typedef {'pending'|'queued'|'syncing'|'submitted'|'approved'|'disapproved'|'warning'|'deleted'|'skipped'|'error'} MerchantSyncStatus
 */

/**
 * @typedef {object} MerchantSyncRow
 * @property {number} id
 * @property {number} product_id
 * @property {number} shop_id
 * @property {string} offer_id
 * @property {string|null} google_product_name
 * @property {string|null} google_product_input_name
 * @property {string|null} data_source_id
 * @property {string|null} data_source_name
 * @property {MerchantSyncStatus} sync_status
 * @property {string|null} google_approval_status
 * @property {string|null} last_synced_at
 * @property {string|null} last_error
 * @property {object} diagnostics
 */

/**
 * @typedef {object} ProductInputPayload
 * @property {string} offerId
 * @property {string} contentLanguage
 * @property {string} feedLabel
 * @property {object} productAttributes
 */

export {};
