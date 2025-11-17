# Multi-Account Wallet Usage Examples

This document shows how to use the new multi-account wallet system (MetaMask-style).

## Initialization

On app startup, initialize the account system (this runs migration automatically):

```javascript
import * as accountManager from './services/accountManager';

// On app startup
await accountManager.initializeAccounts();
```

## Creating a New Account

```javascript
import * as accountManager from './services/accountManager';

// Create a new account (automatically derives from mnemonic)
const newAccount = await accountManager.createNewAccount('My Savings Account');
console.log('New account:', newAccount.address);
console.log('Account index:', newAccount.index);
```

## Getting All Accounts

```javascript
// Get all accounts (without private keys)
const accounts = await accountManager.getAllAccounts();
accounts.forEach(account => {
  console.log(`${account.label}: ${account.address}`);
});
```

## Getting Active Account

```javascript
// Get currently active account
const activeAccount = await accountManager.getActiveAccount();
console.log('Active account:', activeAccount.address);

// Get active account with private key (for signing)
const activeAccountWithKey = await accountManager.getActiveAccount(true);
const privateKey = activeAccountWithKey.privateKey;
```

## Switching Accounts

```javascript
// Switch to account at index 1
await accountManager.switchAccount(1);

// Verify switch
const newActive = await accountManager.getActiveAccount();
console.log('Now active:', newActive.address);
```

## Updating Account Label

```javascript
// Rename an account
await accountManager.updateAccountLabel(0, 'Main Wallet');
```

## Getting Account by Index

```javascript
// Get specific account
const account = await accountManager.getAccountByIndex(2);
if (account) {
  console.log('Account 2:', account.address);
}
```

## Getting Active Account Details

```javascript
// Quick access to active account properties
const address = await accountManager.getActiveAccountAddress();
const did = await accountManager.getActiveAccountDID();
const privateKey = await accountManager.getActiveAccountPrivateKey();
```

## Deleting an Account

```javascript
// Delete account (cannot delete if it's the only account)
try {
  await accountManager.deleteAccount(1);
  console.log('Account deleted');
} catch (error) {
  console.error('Cannot delete:', error.message);
}
```

## Account Count

```javascript
const count = await accountManager.getAccountCount();
console.log(`You have ${count} account(s)`);
```

## Integration with Existing Code

The system is backward compatible. Existing code using `secureStorage.getAddress()`, `secureStorage.getDID()`, etc. will continue to work, but they now return data from the active account.

For new code, prefer using `accountManager` functions:

```javascript
// Old way (still works)
const address = await secureStorage.getAddress();

// New way (recommended)
const address = await accountManager.getActiveAccountAddress();
```

## Example: Full Account Management Flow

```javascript
import * as accountManager from './services/accountManager';

// 1. Initialize (on app startup)
await accountManager.initializeAccounts();

// 2. List all accounts
const accounts = await accountManager.getAllAccounts();
console.log(`You have ${accounts.length} account(s)`);

// 3. Create a new account
if (accounts.length < 5) { // Limit to 5 accounts
  const newAccount = await accountManager.createNewAccount('Savings');
  console.log('Created:', newAccount.label);
}

// 4. Switch to a different account
await accountManager.switchAccount(1);

// 5. Get active account for transactions
const active = await accountManager.getActiveAccount(true);
// Use active.privateKey for signing transactions
```

## Account Data Structure

Each account object contains:

```javascript
{
  index: 0,                    // Account index (0, 1, 2, ...)
  address: "0x...",            // Ethereum address
  publicKey: "0x...",          // Public key
  did: "did:ethr:...",         // DID
  label: "Account 1",           // User-friendly name
  derivationPath: "m/44'/60'/0'/0/0",  // BIP44 path
  createdAt: "2024-01-01T00:00:00.000Z"  // ISO timestamp
  // privateKey is only included when explicitly requested
}
```

## Notes

- All accounts derive from the same mnemonic phrase
- Account indices are sequential (0, 1, 2, ...)
- You can have unlimited accounts (limited only by storage)
- The active account is used for all operations (signing, transactions, etc.)
- Private keys are never exposed in `getAllAccounts()` for security

