import crypto from 'crypto';

/**
 * A key that only this server process knows, for routes the phone helpline calls on its own
 * server (starting an application for a caller). Never sent to browsers.
 */
export const INTERNAL_KEY = crypto.randomBytes(24).toString('base64url');
