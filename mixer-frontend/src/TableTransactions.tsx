import React from 'react';
import { useTransactions } from './useTransactions';
import { HexString } from '@gear-js/api';

interface TableTransactionsProps {
  userId: HexString | undefined;
}

const TableTransactions: React.FC<TableTransactionsProps> = ({ userId }) => {
  const { transactions } = useTransactions(userId);

  return (
    <div style={styles.transactionSection}>
      <div style={styles.transactionColumn}>
        <div style={styles.transactionList}>
          {transactions.filter(tx => tx.amount > 0).map((tx, index) => (
            <div key={index} style={styles.transactionItem}>
              <p>Amount: <span style={styles.amountText}>+{tx.amount * 10}</span></p>
              <p>Time: <span style={styles.timeText}>{new Date(tx.time).toLocaleString()}</span></p>
            </div>
          ))}
        </div>
      </div>
      <div style={styles.transactionColumn}>
        <div style={styles.transactionList}>
          {transactions.filter(tx => tx.amount <= 0).map((tx, index) => (
            <div key={index} style={styles.transactionItem}>
              <p>Amount: <span style={styles.amountText}>{tx.amount * 10}</span></p>
              <p>Time: <span style={styles.timeText}>{new Date(tx.time).toLocaleString()}</span></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  transactionSection: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    flex: 1,
    marginTop: '10px',
    overflow: 'hidden',
  },
  transactionColumn: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  transactionList: {
    flex: 1,
    overflowY: 'auto',
  },
  transactionItem: {
    marginBottom: '10px',
    paddingBottom: '5px',
    borderBottom: '1px solid #dddddd',
    fontSize: '12px',
  },
  amountText: {
    color: '#00aaff',
    fontWeight: '600',
  },
  timeText: {
    color: '#666666',
  },
};

export default TableTransactions;
