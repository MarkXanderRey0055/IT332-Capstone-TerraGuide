export type BuyerAccount = {
  id: number;
  username: string;
  email: string;
  password: string;
};

const BUYERS_STORAGE_KEY = 'terraguide_buyers';
const CURRENT_BUYER_KEY = 'terraguide_currentBuyer';

export function loadBuyerAccounts(): BuyerAccount[] {
  try {
    const raw = window.localStorage.getItem(BUYERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BuyerAccount[]) : [];
  } catch {
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
