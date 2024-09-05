import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/tauri';
import { useTransactions } from './useTransactions';
import { HexString } from '@gear-js/api';
import { addIndexes, getLastIndex } from './utils/IndexedDB';
import { useStopwatch } from 'react-timer-hook';

const TablePage: React.FC = () => {
  const { userId } = useParams<{ userId: HexString }>();
  const { transactions } = useTransactions(userId);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operation, setOperation] = useState<'deposit' | 'withdraw' | null>(null);

  const { seconds, minutes, start, reset, pause } = useStopwatch({ autoStart: false });

  const handleDeposit = async () => {
    if (depositAmount === null) {
      alert("Please select a valid deposit amount.");
      return;
    }
    setIsSubmitting(true);
    setOperation('deposit');
    localStorage.setItem('ongoingTransaction', 'true');
    start(); // Start the stopwatch

    try {
      const shift = await getLastIndex() + 1;
      const startTime = new Date();
      const added: number[] = await invoke('deposit', { addr: userId, amount: depositAmount, shift: shift });
      await addIndexes(added);
      const endTime = new Date();
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000;
      alert(`Deposit of ${depositAmount} was successful. Time taken: ${totalTime} seconds.`);
      localStorage.setItem('ongoingTransaction', 'false');
    } catch (e) {
      console.error(e);
      alert(`Failed to deposit: ${e}`);
      localStorage.setItem('ongoingTransaction', 'false');
    } finally {
      setIsSubmitting(false);
      setOperation(null);
      pause(); // Stop the stopwatch
      reset(); // Reset the stopwatch
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount === null) {
      alert("Please select a valid withdrawal amount.");
      return;
    }
    setIsSubmitting(true);
    setOperation('withdraw');
    localStorage.setItem('ongoingTransaction', 'true');
    start(); // Start the stopwatch

    try {
      const startTime = new Date();
      await invoke('withdraw', { addr: userId, amount: withdrawAmount });

      const endTime = new Date();
      const totalTime = (endTime.getTime() - startTime.getTime()) / 1000;
      alert(`Withdrawal of ${withdrawAmount} was successful. Time taken: ${totalTime} seconds.`);
      localStorage.setItem('ongoingTransaction', 'false');
    } catch (e) {
      console.error(e);
      alert(`Failed to withdraw: ${e}`);
      localStorage.setItem('ongoingTransaction', 'false');
    } finally {
      setIsSubmitting(false);
      setOperation(null);
      pause(); // Stop the stopwatch
      reset(); // Reset the stopwatch
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.actionsContainer}>
        <div style={styles.actionsSection}>
          <div style={styles.action}>
            <div style={styles.selectContainer}>
              <select
                value={depositAmount ?? ''}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                style={styles.select}
                disabled={isSubmitting && operation === 'withdraw'} // Disable if withdrawing
              >
                <option value="" disabled>Amount</option>
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <button
                onClick={handleDeposit}
                disabled={isSubmitting && operation !== 'deposit'} // Disable if another operation
                style={styles.button}
              >
                {isSubmitting && operation === 'deposit' ? `Depositing... ${minutes}:${seconds}s` : 'Deposit'}
              </button>
            </div>
            <div style={styles.selectContainer}>
              <select
                value={withdrawAmount ?? ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                style={styles.select}
                disabled={isSubmitting && operation === 'deposit'} // Disable if depositing
              >
                <option value="" disabled>Amount</option>
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <button
                onClick={handleWithdraw}
                disabled={isSubmitting && operation !== 'withdraw'} // Disable if another operation
                style={styles.button}
              >
                {isSubmitting && operation === 'withdraw' ? `Withdrawing... ${minutes}:${seconds}s` : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    height: '100vh',
    padding: '15px',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    backgroundColor: '#f0f0f0',
    color: '#333333',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  actionsContainer: {
    display: 'flex',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  actionsSection: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '1200px',
  },
  action: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
    flex: 1,
  },
  selectContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
  },
  select: {
    padding: '8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid #cccccc',
    backgroundColor: '#ffffff',
    color: '#333333',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    outline: 'none',
    appearance: 'none',
    width: '100px',
  },
  button: {
    padding: '8px 12px',
    fontSize: '12px',
    backgroundColor: '#007bff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s, transform 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    width: '100px',
  },
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
    fontSize: '12px', // Match font size with select and button
  },
  amountText: {
    color: '#00aaff',
    fontWeight: '600',
  },
  timeText: {
    color: '#666666',
  },
  subheading: {
    fontSize: '1.1rem',
    color: '#000000',
    marginBottom: '10px',
    textAlign: 'center',
  },
};

export default TablePage;
