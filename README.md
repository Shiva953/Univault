# Univault
Univault is an all-in squads vault management solana blink, made possible via actions and action-chaining.

**Blinkathon 2024 [Winner](https://x.com/thesendcoin/status/1839324398102409634) under Squads Protocol track**

## Features

### View Your Squads Vault
  

https://github.com/user-attachments/assets/aca9ec6e-f04f-41e8-a5b6-74aa92b98176


### Make Vault Transactions & Vote on them


https://github.com/user-attachments/assets/5e8ca18b-f765-4edc-b267-1695e8b462df



All in a **single** blink, thanks to the magic of solana blinks and action-chaining!

## Blink Routes
- **`/api/actions/squad`** - The starting point of the blink, upon entering the vault multisig PDA, redirects to the `/api/actions/squad/[vaultId]` action for given vault within the same blink via action chaining.
  
- **`/api/actions/squad/[vaultId]`** - Gives the vault interface with given squad vault address, shows image containing `vault balance`, `total members` and `threshold`. Includes buttons for send and vote transactions. Uses action chaining to redirect to actions for sending and voting, within the same blink.

- **`/api/actions/squad/vote`** - Let's the user vote on a squads vault transaction at a given index, with `Approve Vote`, `Reject`, `Execute`, and `Approve and Execute` options.

- **`/api/actions/squad/send`** - Let's the user make a squads vault sol transfer transaction, which after success redirects to the voting action within the same blink, so that the user(preferrably a vault member) can `vote` on it.
  
- **`/api/actions/squad/deposit`** - Allows for depositing SOL to the squads vault.


