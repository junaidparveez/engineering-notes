---
title: Cryptography
category: springboot
week: 2
topic: Concurrency + profiling
tags: []
created: 2026-09-29
updated: 2026-09-29
---

🔐 A Beginner's Guide to Cryptography & Spring Security

Part 1: The Basics of Cryptography (The "What" and "Why")

Cryptography is the science of protecting information using mathematical techniques. It acts as the digital world's locks, seals, and signatures. By transforming readable data (plaintext) into an unreadable format (ciphertext) using algorithms and keys, it prevents unauthorized access and tampering.

The Core Goals (Why do we need it?)

Cryptography answers three fundamental questions:

Can I keep data secret? → Encryption (Confidentiality)

Can I detect if data was changed? → Hashing & Integrity

Can I prove who sent this data? → Signatures & Authentication

Key Features of Cryptography

Confidentiality: Only the intended recipient can access the information.

Integrity: The information cannot be secretly altered while stored or during transit. If someone tampers with it, we will know.

Authentication: The identities of the sender and receiver are proven and confirmed.

Non-repudiation: The sender cannot later deny that they sent the message (just like a signed contract).

Adaptability & Interoperability: It evolves to beat new threats and works across different modern systems and platforms.

Part 2: The Three Pillars of Cryptography (The "How")

There are three main tools in the cryptography toolbox. Understanding the difference between them is the key to mastering digital security.

1. Symmetric Key Cryptography (The Shared Key)

This is an encryption system where the sender and receiver use the exact same key to lock (encrypt) and unlock (decrypt) the message.

💡 Beginner Analogy: Think of this like a physical padlock on a diary. If you and your best friend both have a copy of the exact same key, you can both lock and unlock the diary.

Pros: Very fast and efficient. Great for encrypting large amounts of data.

Cons: The "Key Sharing Problem." How do you securely give your friend the key in the first place without someone intercepting it?

Popular Algorithms:

AES (Advanced Encryption Standard): The modern gold standard. It is highly secure, widely used today, and supports block sizes of 128, 192, or 256 bits.

DES (Data Encryption Standard): An older algorithm (converts 64-bit data to 48-bit ciphertext). It is considered outdated and weak by today's standards, but useful for learning the basics.

2. Asymmetric Key Cryptography (Public & Private Keys)

Instead of one shared key, this system uses a pair of mathematically linked keys:

Public Key: Shared openly with the world (used to encrypt).

Private Key: Kept strictly secret by the owner (used to decrypt).

💡 Beginner Analogy: Think of a public mailbox. Anyone can drop a letter through the slot (encrypting with the Public Key). However, only the mail carrier holding the master key can open the box to read the letters inside (decrypting with the Private Key).

Pros: Completely solves the key-sharing problem. Enables identity verification.

Cons: Much slower and requires more computing power than Symmetric encryption.

Popular Algorithms:

RSA (Rivest-Shamir-Adleman): The most classic asymmetric algorithm. It works on a block cipher concept.

ECC (Elliptic Curve Cryptography): A modern alternative that provides the same strong security as RSA but uses much smaller keys. It is lightweight, making it perfect for smartphones, IoT devices, and crypto wallets.

3. Hashing (The Digital Fingerprint)

Hashing does not use a key to hide data; instead, it uses an algorithm to convert a message of any size into a fixed-length string of characters (a hash value or digest).

💡 Beginner Analogy: Hashing is like putting a strawberry into a blender. You get a smoothie out. You can never turn the smoothie back into a strawberry (it is strictly one-way). Furthermore, if you blend a strawberry and a blueberry, the color of the smoothie completely changes (even a tiny change in input creates a completely different output).

Popular Algorithms:

SHA-256 (Secure Hash Algorithm): Generates a fixed 256-bit hash. Highly secure and widely used today for digital signatures, blockchain, and password hashing.

SHA-1: An older 160-bit algorithm (developed in 1995). Mostly retired for high-security needs.

MD5: Produces a 128-bit hash. Originally popular for file verification, but no longer considered secure against modern attacks.

MD6: A newer successor to the MD family, designed for modern multi-core processors.

Part 3: Crucial Concepts & Golden Rules

Encryption vs. Hashing

Confusing these two is a common source of security vulnerabilities!

Encryption is Reversible: Used when you need the original data back (e.g., sending a secure message, storing a file).

Hashing is One-Way: Used when you don't need the data back, you just want to verify it (e.g., checking if a file was corrupted, verifying passwords).

⚠️ THE GOLDEN RULE: Passwords must always be hashed, never encrypted! If you encrypt passwords and a hacker steals your decryption key, they have everyone's password. With hashing, they only steal useless "smoothies."

Why Not Use Both Encryption Types? (The Hybrid Approach)

Because symmetric is fast but hard to share keys, and asymmetric is slow but easy to share, modern systems like HTTPS combine them!

Your browser and the server use Asymmetric Encryption just long enough to safely whisper a shared secret key to each other.

Once they both have the secret key, they switch to the much faster Symmetric Encryption to send the actual website data.

Digital Signatures

A digital signature proves who sent the data and that it wasn't modified. It's like a handwritten signature on a contract. It heavily utilizes a combination of Hashing and Asymmetric Cryptography (used in JWTs, OAuth tokens, and secure APIs).

Part 4: Cryptography in Java & Spring Security

Many developers use cryptography without realizing it, thanks to powerful frameworks.

Never Do This (The Old Way)

Java provides standard libraries, but using raw hashing for passwords is a bad idea.

// BAD: SHA-256 alone is too fast, making it vulnerable to hackers guessing passwords quickly (brute-force).
MessageDigest md = MessageDigest.getInstance("SHA-256"); 


The Right Way: Spring Security Password Encoders

Spring Security provides battle-tested tools that do the heavy lifting for you. BCrypt is the standard choice.

// GOOD: Defining the BCrypt Password Encoder in Spring
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}


How to use it:

// Hashing a new password during sign-up
String hash = passwordEncoder.encode(plainTextPassword);

// Verifying a password during login
boolean matches = passwordEncoder.matches(rawPasswordAttempt, hashFromDatabase);


Why BCrypt?

It is purposely slow (which stops hackers from guessing millions of passwords a second).

It automatically adds a "salt" (random data) to passwords to protect against pre-computed hacker databases (rainbow tables).

Where Else Spring Uses Cryptography

You might not see it, but Spring applies cryptography everywhere:

HTTPS and TLS: Spring handles the certificates (asymmetric) and data encryption (symmetric) automatically.

JWT Authentication: Spring Security validates cryptographic signatures on JSON Web Tokens to ensure user identities aren't spoofed.

Secure Configuration: Spring can protect your application's API keys and database passwords by keeping them encrypted in your configuration files.

Summary

Cryptography doesn't have to be scary. You don't need to invent algorithms, do complex math, or manually manage keys. You simply need to:

Understand the purpose of each tool (Encryption vs. Hashing vs. Signatures).

Use the correct abstractions.

Let trusted frameworks like Spring Security and the JVM do the heavy lifting!