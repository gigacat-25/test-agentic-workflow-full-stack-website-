// ============================================================
// JWT Authentication Middleware
//
// Uses the `jose` library for JWT signing/verification (works with
// Cloudflare Workers Edge Runtime — unlike jsonwebtoken which has
// CommonJS compatibility issues).
//
// TODO Phase 2+: Replace with Cloudflare Access or external auth.
// ============================================================

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { StaffRole } from '../db/schema';
import { unauthorized, forbidden } from '../utils/errors';

/**
 * Generate a JWT token for a staff user.
 * Default expiry: 8 hours.
 */
export async function generateToken(
  payload: { staffUserId: string; role: StaffRole },
  secret: string,
  expiresIn: string = '8h',
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    sub: payload.staffUserId,
    role: payload.role,
  } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);

  return token;
}

/**
 * Verify a JWT token and return the payload.
 * Throws AppError(401) if invalid or expired.
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<{ staffUserId: string; role: StaffRole }> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);

    return {
      staffUserId: payload.sub as string,
      role: payload.role as StaffRole,
    };
  } catch (err) {
    throw unauthorized('Invalid or expired token');
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Create an auth middleware function for itty-router.
 * 
 * Usage:
 * ```ts
 * router.get('/api/staff/appointments', withAuth, (request) => { ... })
 * ```
 * 
 * For role-restricted routes:
 * ```ts
 * router.get('/api/staff/patients', withRoles(['admin', 'doctor']), handler)
 * ```
 */
export function createAuthMiddleware(secret: string) {
  /**
   * Basic auth middleware — verifies token, attaches staffUser to request.
   */
  const withAuth = async (request: any): Promise<Response | void> => {
    const token = extractToken(request.headers.get('Authorization'));
    if (!token) {
      throw unauthorized('Missing Authorization header');
    }

    const payload = await verifyToken(token, secret);
    request.staffUser = {
      id: payload.staffUserId,
      role: payload.role,
    };
  };

  /**
   * Role-restricted middleware — requires specific roles after auth.
   */
  const withRoles = (allowedRoles: StaffRole[]) => {
    return async (request: any): Promise<Response | void> => {
      await withAuth(request);
      if (!allowedRoles.includes(request.staffUser?.role)) {
        throw forbidden(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
      }
    };
  };

  return { withAuth, withRoles };
}
