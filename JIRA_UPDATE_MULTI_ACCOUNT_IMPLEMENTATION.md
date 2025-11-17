# JIRA Update: Multi-Account Wallet Implementation (MetaMask-Style)

## Summary
Implemented multi-account wallet functionality allowing users to create, manage, and switch between multiple accounts derived from a single mnemonic phrase, similar to MetaMask's account management system.

## Epic/Story
**Title:** Multi-Account Wallet Support (HD Wallet Derivation)
**Type:** Feature
**Priority:** High
**Status:** ✅ Completed

---

## Description

### Overview
Added support for deriving and managing multiple accounts from a single BIP-39 mnemonic phrase using BIP-44 hierarchical deterministic (HD) wallet derivation. Users can now create unlimited accounts, switch between them, and manage them through an intuitive UI.

### Technical Implementation

#### 1. Core Derivation Functionality
- **File:** `utils/crypto.js`
- **Changes:**
  - Added `deriveAccountAtIndex(mnemonic, accountIndex)` function
  - Supports BIP-44 derivation path: `m/44'/60'/0'/0/{accountIndex}`
  - MetaMask-compatible derivation (same path format)
  - Backward compatible with existing `generateWalletFromMnemonic()` (now uses account index 0)

#### 2. Multi-Account Storage System
- **File:** `services/secureStorage.js`
- **Changes:**
  - Added storage keys: `ACCOUNTS`, `ACTIVE_ACCOUNT_INDEX`, `ACCOUNTS_MIGRATED`
  - Implemented account management functions:
    - `getAllAccounts()` - List all accounts (without private keys)
    - `getActiveAccount()` - Get currently selected account
    - `addAccount()` - Add new account
    - `setActiveAccount()` - Switch accounts
    - `updateAccount()` - Update account label
    - `deleteAccount()` - Remove account
    - `migrateToMultiAccount()` - Auto-migrate existing wallets to Account 0
    - `getNextAccountIndex()` - Get next available account index

#### 3. Account Manager Service
- **File:** `services/accountManager.js` (NEW)
- **Purpose:** High-level API for account operations
- **Functions:**
  - `initializeAccounts()` - Initialize system and run migration
  - `createNewAccount(label)` - Derive and save new account
  - `switchAccount(index)` - Change active account
  - `getActiveAccountIndex()` - Get current account index
  - `getActiveAccountAddress()` - Quick access to active address
  - `getActiveAccountPrivateKey()` - For signing transactions
  - `updateAccountLabel()` - Rename account
  - `deleteAccount()` - Remove account

#### 4. DID Manager Integration
- **File:** `services/didManager.js`
- **Changes:**
  - Updated `createLocalDID()` to save as Account 0
  - Updated `restoreFromMnemonic()` to save as Account 0
  - Updated `getCurrentDID()` and `getWalletInfo()` to use active account
  - Maintains backward compatibility with legacy storage

#### 5. Blockchain Service Integration
- **File:** `services/blockchainService.js`
- **Changes:**
  - Updated `getWallet()` to use `getActiveAccountPrivateKey()`
  - All transactions now use the active account
  - Fallback to legacy storage for backward compatibility

#### 6. App Initialization
- **File:** `app/_layout.js`
- **Changes:**
  - Added `accountManager.initializeAccounts()` on app startup
  - Automatically runs migration for existing users
  - Existing wallets become Account 0 seamlessly

#### 7. Profile Tab - Account Management UI
- **File:** `app/tabs/profile.js`
- **Changes:**
  - Added "Accounts" section with full CRUD operations
  - Features:
    - List all accounts with active indicator
    - Create new account button
    - Switch accounts by tapping
    - Rename accounts (edit icon)
    - Delete accounts (trash icon, disabled if only one account)
    - Copy address (copy icon)
  - Visual indicators for active account (checkmark, highlight)
  - Account card component with actions

#### 8. Transactions Tab - Account Switcher
- **File:** `app/tabs/transactions.js`
- **Changes:**
  - Added account name display in header badge
  - Implemented dropdown account switcher (replaced modal)
  - Shows active account name in balance card
  - Click account badge → dropdown opens
  - Select account → switches and updates balances
  - Fixed false "funds received" alerts when switching accounts
  - Account name visible in header and balance card

---

## Features Implemented

### ✅ Account Creation
- Users can create unlimited accounts from single mnemonic
- Each account uses sequential index (0, 1, 2, ...)
- Automatic naming: "Account 1", "Account 2", etc.
- Custom labels supported

### ✅ Account Switching
- Switch between accounts from Profile tab
- Switch from Transactions tab dropdown
- Active account highlighted with checkmark
- All operations (transactions, balances) use active account

### ✅ Account Management
- Rename accounts with custom labels
- Delete accounts (cannot delete last remaining account)
- Copy account addresses
- View all accounts in list

### ✅ Migration System
- Automatic migration on app startup
- Existing wallets become Account 0
- Preserves all existing data
- One-time migration (tracked with flag)

### ✅ UI/UX Improvements
- Clean dropdown interface (no modals)
- Account name displayed in transactions tab
- Active account indicator in balance card
- Intuitive account selection
- Proper z-index handling for dropdown

---

## Files Modified

### New Files
1. `services/accountManager.js` - Account management service
2. `services/ACCOUNT_USAGE_EXAMPLES.md` - Usage documentation

### Modified Files
1. `utils/crypto.js` - Added `deriveAccountAtIndex()`
2. `services/secureStorage.js` - Multi-account storage functions
3. `services/didManager.js` - Active account integration
4. `services/blockchainService.js` - Use active account for transactions
5. `app/_layout.js` - Initialize accounts on startup
6. `app/tabs/profile.js` - Account management UI
7. `app/tabs/transactions.js` - Account switcher dropdown

---

## Technical Details

### Derivation Path Format
```
m/44'/60'/0'/0/{accountIndex}
```
- `44'` - BIP-44 standard
- `60'` - Ethereum coin type
- `0'` - Account level
- `0` - Change (external addresses)
- `{accountIndex}` - Account number (0, 1, 2, ...)

### Account Data Structure
```javascript
{
  index: 0,
  address: "0x...",
  privateKey: "0x...", // Encrypted in storage
  publicKey: "0x...",
  did: "did:ethr:VoltusWave:0x...",
  label: "Account 1",
  createdAt: "2024-01-01T00:00:00.000Z",
  derivationPath: "m/44'/60'/0'/0/0"
}
```

### Storage Strategy
- All accounts stored in single JSON array: `ssi_accounts`
- Active account index stored separately: `ssi_active_account_index`
- Migration flag: `ssi_accounts_migrated`
- Private keys encrypted by device secure storage

---

## Bug Fixes

### 1. False "Funds Received" Alerts
- **Issue:** Switching accounts triggered false alerts
- **Fix:** Reset balance tracking refs and suppress notifications during account switch
- **Files:** `app/tabs/transactions.js`

### 2. Account Selection Not Working
- **Issue:** Dropdown items not clickable
- **Fix:** Removed blocking backdrop, fixed z-index, improved pointer events
- **Files:** `app/tabs/transactions.js`

### 3. Missing Function Export
- **Issue:** `getActiveAccountIndex` not exported
- **Fix:** Added export to `accountManager.js`
- **Files:** `services/accountManager.js`

---

## Testing Checklist

### ✅ Functional Testing
- [x] Create new account from mnemonic
- [x] Switch between accounts
- [x] Rename account
- [x] Delete account (with multiple accounts)
- [x] Cannot delete last account
- [x] Active account indicator works
- [x] Transactions use active account
- [x] Balances update correctly on switch
- [x] Migration works for existing users

### ✅ UI/UX Testing
- [x] Dropdown appears correctly
- [x] Account badge shows current account
- [x] Dropdown closes on selection
- [x] No false balance alerts
- [x] Account name visible in transactions tab
- [x] Visual indicators work (checkmark, highlight)

### ✅ Edge Cases
- [x] Single account (cannot delete)
- [x] Switching to same account (just closes dropdown)
- [x] Account switching during transaction
- [x] App restart preserves active account

---

## Migration Notes

### For Existing Users
- Automatic migration on first app launch after update
- Existing wallet becomes "Account 1" (index 0)
- All data preserved
- No user action required

### For New Users
- First account created during onboarding
- Saved as Account 0
- Can create additional accounts anytime

---

## API Usage Examples

### Create New Account
```javascript
const newAccount = await accountManager.createNewAccount('Savings Account');
```

### Switch Account
```javascript
await accountManager.switchAccount(1);
```

### Get Active Account
```javascript
const active = await accountManager.getActiveAccount();
const address = await accountManager.getActiveAccountAddress();
const privateKey = await accountManager.getActiveAccountPrivateKey();
```

### List All Accounts
```javascript
const accounts = await accountManager.getAllAccounts();
```

---

## Performance Considerations
- Account derivation is fast (HD wallet from seed)
- Storage uses efficient JSON array
- No performance impact on existing functionality
- Migration runs once on startup

---

## Security Notes
- Private keys remain encrypted in secure storage
- Account list API doesn't expose private keys
- Same security level as single-account implementation
- BIP-44 standard ensures deterministic, secure derivation

---

## Future Enhancements (Out of Scope)
- Account import from private key
- Account export functionality
- Account-specific transaction history
- Account-specific credentials
- Account color coding/theming

---

## Dependencies
- No new dependencies added
- Uses existing: `ethers.js`, `bip39`, `expo-secure-store`

---

## Breaking Changes
- **None** - Fully backward compatible
- Existing code continues to work
- Legacy storage methods still functional

---

## Acceptance Criteria
✅ Users can create multiple accounts from one mnemonic
✅ Users can switch between accounts
✅ Active account is clearly indicated
✅ Transactions use active account
✅ Account management UI is intuitive
✅ Migration works seamlessly
✅ No false balance alerts
✅ All existing functionality preserved

---

## Related Issues
- N/A (New feature implementation)

---

## Notes
- Implementation follows MetaMask's account derivation standard
- All accounts share the same mnemonic (single source of truth)
- Account indices are sequential and cannot be skipped
- Maximum accounts limited only by storage capacity

---

**Developer:** AI Assistant
**Date:** 2024
**Status:** ✅ Ready for Testing

