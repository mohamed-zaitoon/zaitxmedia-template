// Google ID Token verification using JWKS
// No external dependencies - uses Web Crypto API and fetch

interface GoogleIdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  nonce?: string;
}

let cachedJwks: any = null;
let cachedJwksAt = 0;
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function getGoogleJwks(): Promise<any> {
  if (cachedJwks && Date.now() - cachedJwksAt < JWKS_CACHE_TTL) {
    return cachedJwks;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error('Failed to fetch Google JWKS');
  cachedJwks = await res.json();
  cachedJwksAt = Date.now();
  return cachedJwks;
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function decodeJwtHeader(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return JSON.parse(base64UrlDecode(parts[0]));
}

function decodeJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return JSON.parse(base64UrlDecode(parts[1]));
}

async function verifyJwtSignature(token: string, jwks: any): Promise<boolean> {
  try {
    const header = decodeJwtHeader(token);
    const kid = header.kid;
    if (!kid) throw new Error('JWT missing kid header');

    // Find matching key
    let key: any = null;
    for (const k of jwks.keys) {
      if (k.kid === kid) {
        key = k;
        break;
      }
    }
    if (!key) throw new Error('No matching JWK for kid');

    // Import public key
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      {
        kty: key.kty,
        n: key.n,
        e: key.e,
        alg: key.alg,
        use: key.use || 'sig',
        key_ops: key.key_ops || ['verify'],
        ext: true,
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const parts = token.split('.');
    const signedPart = `${parts[0]}.${parts[1]}`;
    const signature = Uint8Array.from(atob(base64UrlDecode(parts[2])), c => c.charCodeAt(0));
    const data = new TextEncoder().encode(signedPart);

    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      cryptoKey,
      signature,
      data
    );
  } catch (err) {
    console.error('JWT signature verification failed:', err);
    return false;
  }
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleIdTokenPayload> {
  // Fetch JWKS
  const jwks = await getGoogleJwks();

  // Verify signature
  const sigValid = await verifyJwtSignature(idToken, jwks);
  if (!sigValid) throw new Error('Invalid JWT signature');

  // Decode payload
  const payload = decodeJwtPayload(idToken) as GoogleIdTokenPayload;

  // Verify issuer
  const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error('Invalid issuer: ' + payload.iss);
  }

  // Verify audience
  if (payload.aud !== clientId) {
    throw new Error('Invalid audience');
  }

  // Verify expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error('Token expired');
  }

  // Verify email_verified if email is present
  if (payload.email && !payload.email_verified) {
    throw new Error('Email not verified');
  }

  return payload;
}
