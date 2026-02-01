// backend/utils/signed-urls.js
const crypto = require('crypto');

/**
 * Generate a signed URL for content access
 * @param {string} contentId - ID of the content (video/file/quiz)
 * @param {string} contentType - Type of content (video/file/quiz)
 * @param {string} userId - User ID requesting access
 * @returns {object} - { signedUrl, expiresAt }
 */
function generateSignedUrl(contentId, contentType, userId) {
  const secret = process.env.SIGNED_URL_SECRET;
  const expiryHours = parseInt(process.env.SIGNED_URL_EXPIRY_HOURS || '2');
  
  // Calculate expiry timestamp
  const expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000);
  
  // Create data to sign
  const dataToSign = `${contentId}:${contentType}:${userId}:${expiresAt}`;
  
  // Generate signature using HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');
  
  // Construct signed URL parameters
  const signedParams = {
    contentId,
    contentType,
    userId,
    expires: expiresAt,
    signature
  };
  
  return {
    signedParams,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

/**
 * Verify a signed URL
 * @param {object} params - Query parameters from URL
 * @returns {boolean} - true if valid, false otherwise
 */
function verifySignedUrl(params) {
  const { contentId, contentType, userId, expires, signature } = params;
  
  if (!contentId || !contentType || !userId || !expires || !signature) {
    return false;
  }
  
  // Check if expired
  const now = Date.now();
  if (now > parseInt(expires)) {
    return false;
  }
  
  // Recreate signature
  const secret = process.env.SIGNED_URL_SECRET;
  const dataToSign = `${contentId}:${contentType}:${userId}:${expires}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');
  
  // Compare signatures (constant-time comparison to prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

module.exports = {
  generateSignedUrl,
  verifySignedUrl
};
