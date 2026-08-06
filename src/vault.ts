import type { BudgetState } from './domain'

const VAULT_KEY = 'rubies-encrypted-vault-v1'
const ITERATIONS = 310_000
let writeQueue: Promise<void> = Promise.resolve()

interface EncryptedVault {
  version: 1
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const deriveKey = async (password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const hasVault = (): boolean => localStorage.getItem(VAULT_KEY) !== null

const encryptAndSave = async (state: BudgetState, password: string): Promise<void> => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, ITERATIONS)
  const plaintext = new TextEncoder().encode(JSON.stringify(state))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  const payload: EncryptedVault = {
    version: 1,
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }

  localStorage.setItem(VAULT_KEY, JSON.stringify(payload))
}

export const saveVault = (state: BudgetState, password: string): Promise<void> => {
  writeQueue = writeQueue.catch(() => undefined).then(() => encryptAndSave(state, password))
  return writeQueue
}

export const openVault = async (password: string): Promise<BudgetState> => {
  const raw = localStorage.getItem(VAULT_KEY)
  if (!raw) throw new Error('No protected budget exists on this device.')

  try {
    const payload = JSON.parse(raw) as EncryptedVault
    if (payload.version !== 1) throw new Error('Unsupported vault format.')
    const salt = base64ToBytes(payload.salt)
    const iv = base64ToBytes(payload.iv)
    const key = await deriveKey(password, salt, payload.iterations)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(payload.ciphertext),
    )
    const state = JSON.parse(new TextDecoder().decode(plaintext)) as BudgetState
    if (state.version !== 2) throw new Error('Unsupported budget data version.')
    return state
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unsupported')) throw error
    throw new Error('That password is incorrect, or the vault is damaged.')
  }
}

export const deleteVault = (): void => localStorage.removeItem(VAULT_KEY)
