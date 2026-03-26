const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  return code === 'PGRST205' || code === '42P01' || message.includes('could not find the table');
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = { dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (current === '--csv') {
      args.csvPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (current === '--user-id') {
      args.userId = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return args;
}

function parseCsv(content) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseDate(input) {
  const [day, month, year] = input.split('/').map((part) => part.trim());
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseNumeric(input) {
  const normalized = input.replace(/\s/g, '').replace(/,/g, '').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value: ${input}`);
  }
  return value;
}

function buildImportModel(rows) {
  const [header, ...body] = rows;
  if (!header || header.length < 8) {
    throw new Error('Unexpected CSV format.');
  }

  const accounts = new Map();
  const categoriesByAccount = new Map();
  const transactions = [];

  for (const columns of body) {
    if (columns.length < 8) continue;

    const [date, accountName, categoryName, amountRaw, amountCurrency, convertedRaw, convertedCurrency, descriptionRaw] = columns;
    const amount = parseNumeric(amountRaw);
    const description = (descriptionRaw || '').trim() || null;
    const accountCurrency = (amountCurrency || '').trim() || (convertedCurrency || '').trim() || 'HUF';
    const accountKey = accountName.trim();
    const normalizedCategory = categoryName.trim();

    if (!accounts.has(accountKey)) {
      accounts.set(accountKey, {
        name: accountKey,
        currency: accountCurrency,
      });
      categoriesByAccount.set(accountKey, new Set());
    }

    const transferToMatch = normalizedCategory.match(/^To '(.+)'$/);
    const transferFromMatch = normalizedCategory.match(/^From '(.+)'$/);
    const isTransfer = Boolean(transferToMatch || transferFromMatch);

    if (!isTransfer) {
      categoriesByAccount.get(accountKey).add(normalizedCategory);
    }

    transactions.push({
      date: parseDate(date.trim()),
      accountName: accountKey,
      categoryName: isTransfer ? null : normalizedCategory,
      type: amount < 0 ? 'expense' : 'income',
      amount: Math.abs(amount),
      note: description || (transferToMatch ? `Transfer to ${transferToMatch[1]}` : transferFromMatch ? `Transfer from ${transferFromMatch[1]}` : null),
      sourceCategory: normalizedCategory,
      convertedAmount: parseNumeric(convertedRaw),
      convertedCurrency: convertedCurrency.trim(),
    });
  }

  return {
    accounts: Array.from(accounts.values()),
    categoriesByAccount,
    transactions,
  };
}

async function deleteOwnedData(supabase, ownedAccountIds) {
  if (ownedAccountIds.length === 0) {
    return;
  }

  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select('id')
    .in('account_id', ownedAccountIds);
  if (txError) throw txError;

  const txIds = (txRows || []).map((row) => row.id);
  if (txIds.length > 0) {
    const { error: txTagError } = await supabase
      .from('transaction_tags')
      .delete()
      .in('transaction_id', txIds);
    if (txTagError) throw txTagError;
  }

  const deletions = [
    supabase.from('transactions').delete().in('account_id', ownedAccountIds),
    supabase.from('tags').delete().in('account_id', ownedAccountIds),
    supabase.from('categories').delete().in('account_id', ownedAccountIds),
    supabase.from('account_invites').delete().in('account_id', ownedAccountIds),
    supabase.from('account_members').delete().in('account_id', ownedAccountIds),
    supabase.from('account_settings').delete().in('account_id', ownedAccountIds),
  ];

  for (const request of deletions) {
    const { error } = await request;
    if (error && !isMissingTableError(error)) throw error;
  }

  const { error: accountError } = await supabase
    .from('accounts')
    .delete()
    .in('id', ownedAccountIds);
  if (accountError) throw accountError;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), '.env'));

  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.csvPath;

  if (!csvPath) {
    throw new Error('Provide a CSV path with --csv <path>.');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl || !publicKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvContent);
  const model = buildImportModel(rows);

  if (args.dryRun) {
    console.log(JSON.stringify({
      accounts: model.accounts.map((account) => account.name),
      categoryCounts: Object.fromEntries(
        Array.from(model.categoriesByAccount.entries()).map(([accountName, categorySet]) => [accountName, categorySet.size]),
      ),
      transactionCount: model.transactions.length,
    }, null, 2));
    return;
  }

  if (!serviceRoleKey && !accessToken) {
    throw new Error('Missing authentication for import. Set SUPABASE_SERVICE_ROLE_KEY plus --user-id, or set SUPABASE_ACCESS_TOKEN.');
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey || publicKey,
    accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false } }
      : { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let userId = args.userId || process.env.MONEFY_IMPORT_USER_ID || null;
  if (!userId && accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error) throw error;
    userId = data.user?.id || null;
  }

  if (!userId) {
    throw new Error('Could not resolve target user id. Provide --user-id or MONEFY_IMPORT_USER_ID when using service role.');
  }

  const { data: ownedAccounts, error: ownedAccountsError } = await supabase
    .from('accounts')
    .select('id')
    .eq('created_by', userId);
  if (ownedAccountsError) throw ownedAccountsError;

  await deleteOwnedData(supabase, (ownedAccounts || []).map((row) => row.id));

  const accountIdByName = new Map();
  const categoryIdByCompositeKey = new Map();

  for (const account of model.accounts) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        name: account.name,
        currency: account.currency,
        created_by: userId,
      })
      .select('id')
      .single();
    if (error) throw error;

    accountIdByName.set(account.name, data.id);

    const { error: settingsError } = await supabase.from('account_settings').upsert({
      account_id: data.id,
      included_in_balance: true,
      initial_balance: 0,
      initial_balance_date: model.transactions[0]?.date || new Date().toISOString().slice(0, 10),
    });
    if (settingsError && !isMissingTableError(settingsError)) throw settingsError;

    const categoryNames = Array.from(model.categoriesByAccount.get(account.name) || []);
    for (const categoryName of categoryNames) {
      const sample = model.transactions.find(
        (transaction) => transaction.accountName === account.name && transaction.categoryName === categoryName,
      );

      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .insert({
          account_id: data.id,
          name: categoryName,
          type: sample?.type || 'expense',
        })
        .select('id')
        .single();
      if (categoryError) throw categoryError;

      categoryIdByCompositeKey.set(`${account.name}::${categoryName}`, categoryData.id);
    }
  }

  const batchSize = 200;
  for (let start = 0; start < model.transactions.length; start += batchSize) {
    const slice = model.transactions.slice(start, start + batchSize);
    const payload = slice.map((transaction) => ({
      account_id: accountIdByName.get(transaction.accountName),
      category_id: transaction.categoryName ? categoryIdByCompositeKey.get(`${transaction.accountName}::${transaction.categoryName}`) || null : null,
      amount: transaction.amount,
      note: transaction.note,
      type: transaction.type,
      date: transaction.date,
      created_by: userId,
    }));

    const { error } = await supabase.from('transactions').insert(payload);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    importedAccounts: model.accounts.length,
    importedTransactions: model.transactions.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});