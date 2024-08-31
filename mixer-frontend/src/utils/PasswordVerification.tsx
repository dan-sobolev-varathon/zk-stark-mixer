const SALT_LENGTH = 32;
const NONCE_LENGTH = 12; // For AES-GCM, a 12-byte nonce is common
const MARKER = ''; // Empty marker for password verification

export async function encryptMarkerWithPassphrase(passphrase: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await deriveKey(passphrase, salt);

    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

    const encoder = new TextEncoder();
    const markerData = encoder.encode(MARKER);

    const encryptedData = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: nonce,
        },
        key,
        markerData
    );

    // Combine salt, nonce, and encryptedData into one object
    const storedData = {
        salt: Array.from(salt),
        nonce: Array.from(nonce),
        encryptedData: Array.from(new Uint8Array(encryptedData))
    };

    // Convert the object to a Base64-encoded JSON string for storage
    localStorage.setItem('passwordData', btoa(JSON.stringify(storedData)));
}

export async function verifyPassword(passphrase: string): Promise<boolean> {
    // Retrieve the Base64-encoded JSON string from localStorage
    const storedDataBase64 = localStorage.getItem('passwordData');
    if (!storedDataBase64) {
        return false; // No stored data, meaning the password cannot be verified
    }

    // Decode and parse the JSON string
    const storedData = JSON.parse(atob(storedDataBase64));

    const salt = new Uint8Array(storedData.salt);
    const nonce = new Uint8Array(storedData.nonce);
    const encryptedData = new Uint8Array(storedData.encryptedData).buffer;

    const key = await deriveKey(passphrase, salt);

    try {
        await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: nonce,
            },
            key,
            encryptedData
        );

        // If decryption is successful, the password is correct
        return true;
    } catch (err) {
        // If decryption fails, the password is incorrect
        return false;
    }
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = encoder.encode(passphrase);

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passphraseKey,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );

    return key;
}