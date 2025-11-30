import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose"
import { randomUUID } from "node:crypto"

const ALGORITHM = "RS256"
const ISSUER = "zezamii-pass"
const AUDIENCE = "access-point.verify"
const MAX_TOKEN_AGE_MS = 10 * 60 * 1000 // 10 minutes

const isDevelopment = process.env.NODE_ENV === "development" || !process.env.PASS_TOKEN_PRIVATE_KEY

// Mock keys for development/preview (DO NOT use in production)
const MOCK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1+fWIcPm15j9QMQG0GtI1VRYZBNk1DmORzGSCyP1Rt8fPW
H5IKm4zV0pXAU2h+KWsv4oXZjdNM4+ODsI4zIKwCWzyAvXkf3qHXIeLI6aCqeWnP
cDi71XofMyVCO95HGYMlTAREZSKqSeFi03JjTqiVnhGHqAWBzAbHtQ==
-----END PRIVATE KEY-----`

const MOCK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tfn1iHD5teY/UDEBtBrSNVUWGQTZNQ5jkcxkgsj9UbfHz1h+SCpuM
1dKVwFNofilrL+KF2Y3TTOPjg7COMyCsAls8gL15H96h1yHiyOmgqnlpz3A4u9V6
HzMlQjveRxmDJUwERGUiqknhYtNyY06olZ4Rh6gFgcwGx7U=
-----END PUBLIC KEY-----`

interface PassTokenClaims {
  iss: string
  aud: string
  org_id: string
  site_id: string
  pass_id: string
  plate?: string
  admit_from: string
  admit_until: string
  single_use: boolean
  iat: number
  exp: number
  jti: string // Unique token ID for replay protection
}

async function getPrivateKey() {
  const privateKeyPem = process.env.PASS_TOKEN_PRIVATE_KEY || (isDevelopment ? MOCK_PRIVATE_KEY : undefined)
  if (!privateKeyPem) {
    throw new Error("PASS_TOKEN_PRIVATE_KEY environment variable not set")
  }
  return await importPKCS8(privateKeyPem, ALGORITHM)
}

async function getPublicKey() {
  const publicKeyPem = process.env.PASS_TOKEN_PUBLIC_KEY || (isDevelopment ? MOCK_PUBLIC_KEY : undefined)
  if (!publicKeyPem) {
    throw new Error("PASS_TOKEN_PUBLIC_KEY environment variable not set")
  }
  return await importSPKI(publicKeyPem, ALGORITHM)
}

export async function signPassToken(payload: {
  orgId: string
  siteId: string
  passId: string
  plate?: string
  admitFrom: string
  admitUntil: string
  singleUse: boolean
  expiresInMs?: number
}): Promise<string> {
  const privateKey = await getPrivateKey()
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = payload.expiresInMs || MAX_TOKEN_AGE_MS
  const exp = now + Math.floor(expiresIn / 1000)

  // Generate unique token ID for replay protection
  const jti = randomUUID()

  const token = await new SignJWT({
    org_id: payload.orgId,
    site_id: payload.siteId,
    pass_id: payload.passId,
    plate: payload.plate,
    admit_from: payload.admitFrom,
    admit_until: payload.admitUntil,
    single_use: payload.singleUse,
    jti,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey)

  return token
}

export async function verifyPassToken(token: string): Promise<PassTokenClaims> {
  const publicKey = await getPublicKey()

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALGORITHM],
  })

  return payload as unknown as PassTokenClaims
}

export function generateTokenId(): string {
  return randomUUID()
}
