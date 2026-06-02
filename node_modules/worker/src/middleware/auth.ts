// ============================================================
// Authentication Middleware (Clerk & Symmetric Fallback)
//
// Uses the `jose` library for JWT signing/verification. Supports:
// 1. Clerk JWKS token validation (when config URL starts with http).
// 2. Symmetric local JWT validation (fallback).
// ============================================================

import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { StaffRole } from '../db/schema';
import { unauthorized, forbidden } from '../utils/errors';

let jwksClient: any = null;

function getJwksClient(jwksUrl: string) {
  if (!jwksClient) {
    jwksClient = createRemoteJWKSet(new URL(jwksUrl));
  }
  return jwksClient;
}

/**
 * Verify a Clerk JWT token, sync/load user from D1 database, and return user context.
 */
export async function verifyClerkToken(
  token: string,
  jwksUrl: string,
  db?: D1Database,
): Promise<{ id: string; name: string; email: string; role: StaffRole }> {
  try {
    const JWKS = getJwksClient(jwksUrl);
    const { payload } = await jwtVerify(token, JWKS);

    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      throw unauthorized('Token payload is missing subject (sub)');
    }

    // Clerk JWT claims (email custom claim or standard fields)
    const email = (payload.email || (payload as any).primary_email_address || '') as string;
    const name = (payload.name || (payload as any).first_name || email || 'Clerk User') as string;
    
    // Determine role from metadata or fallback to receptionist
    const metadata = (payload.metadata || (payload as any).public_metadata || {}) as Record<string, any>;
    const role = (payload.role || metadata.role || 'receptionist') as StaffRole;

    let staffUser: any = null;

    if (db) {
      // First try by ID (which could be the Clerk ID)
      staffUser = await db
        .prepare('SELECT * FROM staff_users WHERE id = ?')
        .bind(clerkUserId)
        .first();

      // If not found and email is in payload, try looking up by email
      if (!staffUser && email) {
        staffUser = await db
          .prepare('SELECT * FROM staff_users WHERE email = ?')
          .bind(email.toLowerCase().trim())
          .first();
      }

      // If still not found, we insert them so DB operations work
      if (!staffUser) {
        staffUser = {
          id: clerkUserId,
          name,
          email: email || `${clerkUserId}@clerk.user`,
          role,
        };

        try {
          await db
            .prepare(
              'INSERT INTO staff_users (id, name, role, email, password_hash) VALUES (?, ?, ?, ?, ?)'
            )
            .bind(
              staffUser.id,
              staffUser.name,
              staffUser.role,
              staffUser.email.toLowerCase().trim(),
              'clerk_oauth_external'
            )
            .run();
        } catch (err) {
          // If insert fails due to unique/conflict, load the user
          console.error('Failed to auto-insert Clerk user in D1:', err);
          staffUser = await db
            .prepare('SELECT * FROM staff_users WHERE email = ?')
            .bind(staffUser.email.toLowerCase().trim())
            .first();
        }
      }
    } else {
      // If DB is not available (like in some lightweight router contexts), return mock-synced user
      staffUser = {
        id: clerkUserId,
        name,
        email: email || `${clerkUserId}@clerk.user`,
        role,
      };
    }

    return {
      id: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      role: staffUser.role as StaffRole,
    };
  } catch (err: any) {
    console.error('Clerk JWT verification failed:', err);
    throw unauthorized(`Invalid or expired token: ${err.message || 'Verification error'}`);
  }
}

/**
 * Generate a symmetric JWT token for a staff user (used in fallback/testing).
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
 * Verify a token and return user details. Supports Clerk (JWKS URL) and symmetric secrets.
 */
export async function verifyToken(
  token: string,
  secretOrJwksUrl: string,
  db?: D1Database,
): Promise<{ staffUserId: string; role: StaffRole }> {
  if (secretOrJwksUrl.startsWith('http://') || secretOrJwksUrl.startsWith('https://')) {
    const user = await verifyClerkToken(token, secretOrJwksUrl, db);
    return {
      staffUserId: user.id,
      role: user.role,
    };
  }

  try {
    const secretKey = new TextEncoder().encode(secretOrJwksUrl);
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
 */
export function createAuthMiddleware(secretOrJwksUrl: string, db?: D1Database) {
  const withAuth = async (request: any): Promise<Response | void> => {
    const token = extractToken(request.headers.get('Authorization'));
    if (!token) {
      throw unauthorized('Missing Authorization header');
    }

    const payload = await verifyToken(token, secretOrJwksUrl, db);
    request.staffUser = {
      id: payload.staffUserId,
      role: payload.role,
    };
  };

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
