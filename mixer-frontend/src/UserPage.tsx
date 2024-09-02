import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addIndexes, getLastIndex, getUserByAddr, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';
import { invoke } from '@tauri-apps/api/tauri';
import { useTransactions } from './useTransactions';
import { useBalance } from './useBalance';

const UserPage: React.FC = () => {
  const { userId } = useParams<{ userId: HexString }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<IUser>();
  const { transactions } = useTransactions(userId);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { balance } = useBalance(userId);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      const user = await getUserByAddr(userId);
      setUser(user);
    };
    fetchUser();
  }, [userId]);

  const handleBack = () => {
    navigate('/entry');
  };

  const handleDeposit = async () => {
    if (depositAmount === null) {
      alert("Please select a valid deposit amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      const shift = await getLastIndex() + 1;
      const added: number[] = await invoke('deposit', { addr: user!.addr, amount: depositAmount, shift: shift});
      await addIndexes(added);
      alert(`Deposit of ${depositAmount} was successful.`);
    } catch (e) {
      console.error(e);
      alert(`Failed to deposit: ${e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount === null) {
      alert("Please select a valid withdrawal amount.");
      return;
    }
    setIsSubmitting(true);
    try {
      await invoke('withdraw', { addr: user!.addr, amount: withdrawAmount });
      alert(`Withdrawal of ${withdrawAmount} was successful.`);
    } catch (e) {
      console.error(e);
      alert(`Failed to withdraw: ${e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>User Dashboard</h1>

      <div style={styles.topSection}>
        <p style={styles.welcomeMessage}>Welcome, {user ? user.name : 'User'}!</p>
        <div style={styles.balanceSection}>
          <h2 style={styles.balanceLabel}>Balance:</h2>
          <p style={styles.balanceAmount}>
            {balance !== undefined ? `${balance} Tokens` : 'Loading...'}
          </p>
        </div>
      </div>

      <div style={styles.depositSection}>
        <div style={styles.depositControls}>
          <select 
            style={styles.select}
            value={depositAmount ?? ''} 
            onChange={(e) => setDepositAmount(Number(e.target.value))}
          >
            <option value="" disabled>Select amount</option>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
          <button 
            style={styles.depositButton} 
            onClick={handleDeposit} 
            disabled={isSubmitting || depositAmount === null}
          >
            {isSubmitting ? "Depositing..." : "Deposit"}
          </button>
        </div>
      </div>

      <div style={styles.withdrawSection}>
        <div style={styles.withdrawControls}>
          <select 
            style={styles.select}
            value={withdrawAmount ?? ''} 
            onChange={(e) => setWithdrawAmount(Number(e.target.value))}
          >
            <option value="" disabled>Select amount</option>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
          <button 
            style={styles.withdrawButton} 
            onClick={handleWithdraw} 
            disabled={isSubmitting || withdrawAmount === null}
          >
            {isSubmitting ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
      </div>

      <button style={styles.backButton} onClick={handleBack}>Back to Entry Page</button>

      <div style={styles.transactionSection}>
        <div style={styles.transactionColumn}>
          <h2 style={styles.subheading}>Deposits</h2>
          <div style={styles.transactionList}>
            {transactions.filter(tx => tx.amount > 0).map((tx, index) => (
              <div key={index} style={styles.transactionItem}>
                <p>Amount: <span style={styles.amountText}>+{tx.amount}</span></p>
                <p>Time: <span style={styles.timeText}>{new Date(tx.time).toLocaleString()}</span></p>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.transactionColumn}>
          <h2 style={styles.subheading}>Withdrawals</h2>
          <div style={styles.transactionList}>
            {transactions.filter(tx => tx.amount <= 0).map((tx, index) => (
              <div key={index} style={styles.transactionItem}>
                <p>Amount: <span style={styles.amountText}>{tx.amount}</span></p>
                <p>Time: <span style={styles.timeText}>
                  {new Date(
                    Number(tx.time.toString().replace(/,/g, ''))
                  ).toLocaleString()}</span></p>
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
    width: '100vw',
    height: '100vh',
    padding: '10px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#1e1e1e',
    color: '#f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden', // Prevent scrollbars on the overall screen
  },
  heading: {
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: '10px',
    fontSize: '1.5rem', // Reduced font size for compactness
  },
  topSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px', // Reduced margin for compactness
  },
  welcomeMessage: {
    color: '#cccccc',
    fontSize: '0.9rem', // Reduced font size for compactness
    flex: 1,
    marginRight: '10px', // Reduced margin for compactness
  },
  balanceSection: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  balanceLabel: {
    fontSize: '1rem',
    color: '#f0f0f0',
    marginRight: '5px', // Reduced margin for compactness
  },
  balanceAmount: {
    fontSize: '1rem', // Reduced font size for compactness
    fontWeight: 'bold',
    color: '#FFD700', // Gold color for balance
  },
  depositSection: {
    textAlign: 'center',
    flexShrink: 0,
  },
  subheading: {
    fontSize: '1.2rem', // Reduced font size for compactness
    color: '#f0f0f0',
    marginBottom: '5px', // Reduced margin for compactness
  },
  depositControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '5px', // Reduced gap for compactness
  },
  select: {
    padding: '6px', // Reduced padding for compactness
    fontSize: '12px', // Reduced font size for compactness
    borderRadius: '5px',
    border: '1px solid #555',
    backgroundColor: '#444',
    color: '#fff',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
  },
  depositButton: {
    padding: '6px 12px', // Reduced padding for compactness
    fontSize: '12px', // Reduced font size for compactness
    backgroundColor: '#4CAF50',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  backButton: {
    alignSelf: 'center',
    marginBottom: '10px', // Reduced margin for compactness
    padding: '6px 12px', // Reduced padding for compactness
    fontSize: '12px', // Reduced font size for compactness
    backgroundColor: '#444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  transactionSection: {
    display: 'flex',
    justifyContent: 'space-between',
    flex: 1,
    marginTop: '5px', // Reduced margin for compactness
    overflow: 'hidden', // Prevent scrolling on the overall section
  },
  transactionColumn: {
    flex: 1,
    marginLeft: '5px',
    marginRight: '5px',
    overflowY: 'auto', // Scrollbars for transactions if content overflows
    maxHeight: 'calc(100vh - 180px)', // Adjusted height for compactness
    display: 'flex',
    flexDirection: 'column',
  },
  transactionList: {
    flex: 1,
    overflowY: 'auto', // Ensure only one scrollbar for each transaction list
  },
  transactionItem: {
    marginBottom: '5px', // Reduced margin for compactness
    paddingBottom: '5px',
    borderBottom: '1px solid #444',
  },
  amountText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  timeText: {
    color: '#cccccc',
  },
  withdrawSection: {
    textAlign: 'center',
    marginTop: '10px', // Reduced margin for compactness
    flexShrink: 0,
  },
  withdrawControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '5px', // Reduced gap for compactness
  },
  withdrawButton: {
    padding: '6px 12px', // Reduced padding for compactness
    fontSize: '12px', // Reduced font size for compactness
    backgroundColor: '#FF5733', // A different color to distinguish from deposit button
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
};

export default UserPage;
