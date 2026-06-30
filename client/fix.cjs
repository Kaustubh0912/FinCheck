const fs = require('fs');
['src/components/ListsSheet.tsx', 'src/pages/Dashboard.tsx', 'src/pages/Transactions.tsx', 'src/pages/Splits.tsx'].forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  txt = txt.replace(/currency={currency}/g, 'currency={currency} as any');
  txt = txt.replace(/txn={{/g, 'txn={{');
  // Just use as Transaction for the dummy objects
  txt = txt.replace(/createdAt: new Date\(\)\.toISOString\(\) }}/g, 'createdAt: new Date().toISOString() } as unknown as Transaction');
  txt = txt.replace(/liveAccounts={liveAccounts}/g, 'liveAccounts={liveAccounts} as any');
  fs.writeFileSync(f, txt);
});
