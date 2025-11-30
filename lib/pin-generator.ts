/**
 * Generate a secure random PIN for lock access
 * @param length - Length of the PIN (default: 6)
 * @returns A numeric PIN string
 */
export function generateSecurePin(length = 6): string {
  // Use crypto.getRandomValues for cryptographically secure random numbers
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)

  // Convert to digits 0-9
  return Array.from(array)
    .map((num) => num % 10)
    .join("")
}
