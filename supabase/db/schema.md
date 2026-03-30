# Finduo Database Schema

> Auto-generated from migration analysis. Reflects the final state as of 2026-03-30.

---

## accounts

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| currency | TEXT | NOT NULL |
| created_by | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| tag_ids | JSONB | DEFAULT '[]' |
| icon | TEXT | nullable |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**RLS:** Enabled. Owner or account member access.

---

## account_members

| Column | Type | Constraints |
|---|---|---|
| account_id | UUID | PK (composite), FK -> accounts(id) ON DELETE CASCADE |
| user_id | UUID | PK (composite), FK -> auth.users(id) ON DELETE CASCADE |
| role | TEXT | NOT NULL, DEFAULT 'member' |

**RLS:** Enabled. Members see co-members; authenticated users can join (via invite flow).

---

## transactions

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| account_id | UUID | NOT NULL, FK -> accounts(id) ON DELETE CASCADE |
| category_id | UUID | nullable, FK -> categories(id) ON DELETE SET NULL |
| amount | NUMERIC | NOT NULL |
| note | TEXT | nullable |
| type | TEXT | NOT NULL, CHECK IN ('income', 'expense') |
| date | DATE | NOT NULL |
| created_by | UUID | nullable, FK -> auth.users(id) ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**RLS:** Enabled. Account membership access.

---

## transaction_tags

| Column | Type | Constraints |
|---|---|---|
| transaction_id | UUID | PK (composite), FK -> transactions(id) ON DELETE CASCADE |
| tag_id | UUID | PK (composite), FK -> tags(id) ON DELETE CASCADE |

**RLS:** Enabled. Via transaction's account membership.

---

## categories

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| user_id | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| account_id | UUID | nullable, FK -> accounts(id) (legacy, unused) |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL, CHECK IN ('income', 'expense') |
| color | TEXT | nullable |
| icon | TEXT | nullable |
| tag_ids | JSONB | DEFAULT '[]' |

**Indexes:** idx_categories_user_id (user_id)

**RLS:** Enabled.
- SELECT: own categories + categories from users you share an account with
- INSERT/UPDATE/DELETE: own categories only

---

## tags

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| account_id | UUID | nullable, FK -> accounts(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| color | TEXT | nullable |
| icon | TEXT | nullable |

**RLS:** Enabled. Global tags (account_id IS NULL) visible to all authenticated; account-scoped tags visible to account members.

---

## account_invites

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| account_id | UUID | NOT NULL, FK -> accounts(id) ON DELETE CASCADE |
| token | TEXT | NOT NULL, UNIQUE |
| name | TEXT | nullable |
| invited_by | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| expires_at | TIMESTAMPTZ | NOT NULL |
| used_at | TIMESTAMPTZ | nullable |

**RLS:** Enabled.
- SELECT: any authenticated user (token-based lookup)
- INSERT: account members
- UPDATE: any authenticated user (for invite redemption)
- DELETE: invite creator only

---

## user_preferences

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | PK, FK -> auth.users(id) ON DELETE CASCADE |
| account_order | JSONB | DEFAULT '[]' |
| primary_account_id | UUID | nullable |
| excluded_account_ids | TEXT[] | NOT NULL, DEFAULT '{}' |
| updated_at | TIMESTAMPTZ | nullable |

**RLS:** Enabled. Users manage their own row only.

---

## account_settings

| Column | Type | Constraints |
|---|---|---|
| account_id | UUID | PK, FK -> accounts(id) ON DELETE CASCADE |
| included_in_balance | BOOLEAN | NOT NULL, DEFAULT TRUE |
| carry_over_balance | BOOLEAN | NOT NULL, DEFAULT TRUE |
| initial_balance | NUMERIC | NOT NULL, DEFAULT 0 |
| initial_balance_date | DATE | nullable |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**RLS:** Enabled. Account owner (accounts.created_by) OR account member access.

---

## user_profiles

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | PK, FK -> auth.users(id) ON DELETE CASCADE |
| display_name | TEXT | nullable |
| email | TEXT | UNIQUE, nullable |
| avatar_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**RLS:** Enabled.
- SELECT: all authenticated users
- INSERT/UPDATE/DELETE: own row only

---

## friends

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| user_id | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| friend_user_id | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'accepted', 'rejected', 'blocked') |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**Unique:** (user_id, friend_user_id)

**Indexes:** friends_user_id_idx, friends_friend_user_id_idx

**RLS:** Enabled.
- SELECT: participants (blocked rows hidden from target)
- INSERT: requester only, status must be 'pending'
- UPDATE: either participant
- DELETE: requester only

---

## user_hidden_categories

| Column | Type | Constraints |
|---|---|---|
| user_id | UUID | PK (composite), FK -> auth.users(id) ON DELETE CASCADE |
| category_id | UUID | PK (composite), FK -> categories(id) ON DELETE CASCADE |

**RLS:** Enabled. Users manage their own hidden categories.

---

## pools

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL, CHECK IN ('event', 'continuous') |
| created_by | UUID | NOT NULL, DEFAULT auth.uid(), FK -> auth.users(id) ON DELETE CASCADE |
| start_date | DATE | nullable |
| end_date | DATE | nullable |
| status | TEXT | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'closed') |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**RLS:** Enabled.
- SELECT: creator OR pool member
- INSERT/UPDATE/DELETE: creator only

---

## pool_members

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| pool_id | UUID | NOT NULL, FK -> pools(id) ON DELETE CASCADE |
| user_id | UUID | nullable, FK -> auth.users(id) ON DELETE CASCADE |
| display_name | TEXT | nullable |
| joined_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Unique Index:** (pool_id, user_id) WHERE user_id IS NOT NULL

**RLS:** Enabled. Users see/insert/delete own membership rows only. Owner operations handled via RPC functions.

---

## pool_transactions

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| pool_id | UUID | NOT NULL, FK -> pools(id) ON DELETE CASCADE |
| paid_by | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| amount | NUMERIC | NOT NULL, CHECK > 0 |
| description | TEXT | NOT NULL, DEFAULT '' |
| date | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** idx_pool_transactions_pool_id

**RLS:** Enabled. Pool members can SELECT/INSERT; payer can UPDATE/DELETE.

---

## debts

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| from_user | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| to_user | UUID | NOT NULL, FK -> auth.users(id) ON DELETE CASCADE |
| amount | NUMERIC | NOT NULL, CHECK > 0 |
| pool_id | UUID | nullable, FK -> pools(id) ON DELETE SET NULL |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending', 'confirmed', 'paid') |
| from_confirmed | BOOLEAN | NOT NULL, DEFAULT FALSE |
| to_confirmed | BOOLEAN | NOT NULL, DEFAULT FALSE |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

**Indexes:** idx_debts_from_user, idx_debts_to_user, idx_debts_pool_id

**RLS:** Enabled.
- SELECT/UPDATE: either party
- INSERT: debtor, or pool member for settlement debts

---

## RPC Functions

### delete_own_account(p_account_id UUID)
SECURITY DEFINER. Only account owner (accounts.created_by). Cascade-deletes all children: transaction_tags, transactions, tags, account_invites, account_members, account_settings, then the account itself.

### get_pool_members(p_pool_id UUID)
SECURITY DEFINER. Returns all members of a pool. Caller must be a member or the pool owner.

### add_pool_member(p_pool_id UUID, p_user_id UUID, p_display_name TEXT)
SECURITY DEFINER. Only pool owner can add members (app users or guests).

### remove_pool_member(p_member_id UUID)
SECURITY DEFINER. Only pool owner can remove members by row ID.
