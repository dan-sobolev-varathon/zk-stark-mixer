import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserByAddr, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';
import { invoke } from '@tauri-apps/api/tauri';
import { useTransactions } from './useTransactions';

const UserPage: React.FC = () => {
  const { userId } = useParams<{ userId: HexString }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<IUser>();
  const { transactions } = useTransactions(userId as HexString);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await invoke('deposit', { addr: user!.addr, amount: depositAmount });
      alert(`Deposit of ${depositAmount} was successful.`);
    } catch (e) {
      console.error(e);
      alert(`Failed to deposit: ${e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>User Dashboard</h1>

      <div style={styles.topSection}>
        <p style={styles.welcomeMessage}>Welcome, {user ? user.name : 'User'}!</p>
        <div style={styles.depositSection}>
          <h2 style={styles.subheading}>Make a Deposit</h2>
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
    padding: '20px',
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
    fontSize: '2rem',
  },
  topSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  welcomeMessage: {
    color: '#cccccc',
    fontSize: '1rem',
    flex: 1,
    marginRight: '20px',
  },
  depositSection: {
    textAlign: 'center',
    flexShrink: 0,
  },
  subheading: {
    fontSize: '1.5rem',
    color: '#f0f0f0',
    marginBottom: '10px',
  },
  depositControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
  },
  select: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '5px',
    border: '1px solid #555',
    backgroundColor: '#444',
    color: '#fff',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
  },
  depositButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#4CAF50',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  backButton: {
    alignSelf: 'center',
    marginBottom: '20px',
    padding: '8px 16px',
    fontSize: '14px',
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
    marginTop: '10px',
    overflow: 'hidden', // Prevent scrolling on the overall section
  },
  transactionColumn: {
    flex: 1,
    marginLeft: '5px',
    marginRight: '5px',
    overflowY: 'auto', // Scrollbars for transactions if content overflows
    maxHeight: 'calc(100vh - 250px)', // Adjust the height to fit on screen
    display: 'flex',
    flexDirection: 'column',
  },
  transactionList: {
    flex: 1,
    overflowY: 'auto', // Ensure only one scrollbar for each transaction list
  },
  transactionItem: {
    marginBottom: '10px',
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
};

export default UserPage;
