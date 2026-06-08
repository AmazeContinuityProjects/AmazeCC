import crypto from 'crypto';

const SECRET = process.env.ADMIN_SECRET || 'fallback_secret_change_me_in_production';

/**
 * Generates an HMAC SHA-256 signature for the given payload.
 */
function generateSignature(payload: string): string {
    return crypto
        .createHmac('sha256', SECRET)
        .update(payload)
        .digest('hex');
}

/**
 * Signs a username to create a secure admin token.
 * Format: base64(payload).signature
 */
export function signAdminToken(username: string): string {
    const payloadObj = {
        username,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days expiration
    };
    
    const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const signature = generateSignature(payloadStr);
    
    return `${payloadStr}.${signature}`;
}

/**
 * Verifies a token and returns the username if valid and not expired.
 * Returns null if invalid or expired.
 */
export function verifyAdminToken(token: string): string | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 2) return null;
        
        const [payloadStr, signature] = parts;
        
        // Verify signature
        const expectedSignature = generateSignature(payloadStr);
        // Use timingSafeEqual to prevent timing attacks
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'utf8'),
            Buffer.from(expectedSignature, 'utf8')
        );
        
        if (!isValid) return null;
        
        // Parse payload
        const payloadObj = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'));
        
        // Check expiration
        if (Date.now() > payloadObj.exp) {
            return null; // Token expired
        }
        
        return payloadObj.username;
    } catch (err) {
        return null;
    }
}
