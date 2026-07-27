export type BuyerAccount = {
  id: number;
  username: string;
  email: string;
  password: string;
};

const BUYERS_STORAGE_KEY = 'terraguide_buyers';
const CURRENT_BUYER_KEY = 'terraguide_currentBuyer';

function normalizeBuyerAccount(account: Partial<BuyerAccount> | null | undefined): BuyerAccount | null {
  if (!account || typeof account !== 'object') {
    return null;
  }

  const username = typeof account.username === 'string' ? account.username.trim() : '';
  const email = typeof account.email === 'string' ? account.email.trim().toLowerCase() : '';
  const password = typeof account.password === 'string' ? account.password : '';
  const id = typeof account.id === 'number' && Number.isFinite(account.id) ? account.id : Date.now();

  if (!username || !email || !password) {
    return null;
  }

  return {
    id,
    username,
    email,
    password,
  };
}

export function loadBuyerAccounts(): BuyerAccount[] {
  try {
    const raw = window.localStorage.getItem(BUYERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(BUYERS_STORAGE_KEY);
      return [];
    }

    const normalizedAccounts = parsed
      .map((entry) => normalizeBuyerAccount(entry as Partial<BuyerAccount>))
      .filter((entry): entry is BuyerAccount => entry !== null);

    const seen = new Set<string>();
    const dedupedAccounts = normalizedAccounts.filter((account) => {
      const key = `${account.username.toLowerCase()}::${account.email.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (dedupedAccounts.length !== normalizedAccounts.length) {
      saveBuyerAccounts(dedupedAccounts);
    }

    return dedupedAccounts;
  } catch {
    window.localStorage.removeItem(BUYERS_STORAGE_KEY);
    return [];
  }
}

export function saveBuyerAccounts(accounts: BuyerAccount[]): void {
  window.localStorage.setItem(BUYERS_STORAGE_KEY, JSON.stringify(accounts));
}

export function removeBuyerAccount(id: number): void {
  const account = loadBuyerAccounts().find((entry) => entry.id === id);
  if (!account) return;

  saveBuyerAccounts(loadBuyerAccounts().filter((entry) => entry.id !== id));

  try {
    const currentBuyer = window.localStorage.getItem(CURRENT_BUYER_KEY);
    if (currentBuyer) {
      const parsed = JSON.parse(currentBuyer) as { username?: string; email?: string };
      const matchesCurrent =
        parsed.username?.toLowerCase() === account.username.toLowerCase() ||
        parsed.email?.toLowerCase() === account.email.toLowerCase();
      if (matchesCurrent) {
        window.localStorage.removeItem(CURRENT_BUYER_KEY);
      }
    }
  } catch {
    // ignore malformed session data
  }

  window.localStorage.removeItem(`terraguide_welcomeCompleted:${account.username}`);
}