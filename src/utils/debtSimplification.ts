interface Balance {
  userId: string;
  amount: number;
}

interface SimplifiedSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export function simplifyDebts(balances: Balance[]): SimplifiedSettlement[] {
  // Filter out zero balances and sort by amount (descending)
  // Note: A positive balance means someone is owed money
  // A negative balance means someone owes money
  const nonZeroBalances = balances
    .filter(b => b.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  const settlements: SimplifiedSettlement[] = [];
  let i = 0;
  let j = nonZeroBalances.length - 1;

  while (i < j) {
    const creditor = nonZeroBalances[i];  // Person who is owed money (positive balance)
    const debtor = nonZeroBalances[j];    // Person who owes money (negative balance)

    if (Math.abs(creditor.amount) === Math.abs(debtor.amount)) {
      // Exact match - one settlement
      settlements.push({
        fromUserId: debtor.userId,    // Person who owes money
        toUserId: creditor.userId,     // Person who is owed money
        amount: Math.abs(debtor.amount)
      });
      i++;
      j--;
    } else if (Math.abs(creditor.amount) > Math.abs(debtor.amount)) {
      // Creditor is owed more than debtor owes
      settlements.push({
        fromUserId: debtor.userId,    // Person who owes money
        toUserId: creditor.userId,     // Person who is owed money
        amount: Math.abs(debtor.amount)
      });
      creditor.amount += debtor.amount;  // Reduce what creditor is owed
      j--;
    } else {
      // Debtor owes more than creditor is owed
      settlements.push({
        fromUserId: debtor.userId,    // Person who owes money
        toUserId: creditor.userId,     // Person who is owed money
        amount: Math.abs(creditor.amount)
      });
      debtor.amount += creditor.amount;  // Reduce what debtor owes
      i++;
    }
  }

  return settlements;
} 