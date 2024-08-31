import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getUserByAddr, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';
import { invoke } from '@tauri-apps/api/tauri';
import { useTransactions } from './useTransactions';

const UserPage: React.FC = () => {
  const { userId } = useParams<{ userId: HexString }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<IUser | undefined>(undefined);
  const { transactions } = useTransactions(userId as HexString);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      const user0 = await getUserByAddr(userId);
      setUser(user0);
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
      <p style={styles.welcomeMessage}>Welcome, {user ? user.name : 'User'}!</p>
      <button style={styles.backButton} onClick={handleBack}>Back to Entry Page</button>

      <div style={styles.depositSection}>
        <h2 style={styles.subheading}>Make a Deposit</h2>
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

      <div style={styles.transactionSection}>
        <div style={styles.transactionColumn}>
          <h2 style={styles.subheading}>Deposits</h2>
          <div style={styles.transactionList}>
            {transactions.filter(tx => tx.amount > 0).map((tx, index) => (
              <div key={index} style={styles.transactionItem}>
                <p>Amount: <span style={styles.amountText}>+{tx.amount}</span></p>
                <p>Time: <span style={styles.timeText}>{new Date(
                    Number(tx.time.toString().replace(/,/g, ''))
                  ).toLocaleString()}</span></p>
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
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#1e1e1e',
    borderRadius: '10px',
    color: '#f0f0f0',
    boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.3)',
  },
  heading: {
    textAlign: 'center',
    color: '#ffffff',
    marginBottom: '20px',
    fontSize: '2rem',
  },
  welcomeMessage: {
    textAlign: 'center',
    color: '#cccccc',
    fontSize: '1.2rem',
    marginBottom: '30px',
  },
  backButton: {
    display: 'block',
    margin: '0 auto 30px auto',
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  depositSection: {
    marginBottom: '30px',
    textAlign: 'center',
  },
  subheading: {
    fontSize: '1.5rem',
    color: '#f0f0f0',
    marginBottom: '15px',
  },
  select: {
    padding: '10px',
    fontSize: '16px',
    borderRadius: '5px',
    border: '1px solid #555',
    backgroundColor: '#333',
    color: '#fff',
    marginRight: '10px',
  },
  depositButton: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  transactionSection: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '30px',
  },
  transactionColumn: {
    width: '48%',
  },
  transactionList: {
    backgroundColor: '#333',
    borderRadius: '5px',
    padding: '15px',
    maxHeight: '400px',
    overflowY: 'auto',
    boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.2)',
  },
  transactionItem: {
    marginBottom: '15px',
    paddingBottom: '10px',
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
