import React, { useEffect, useState } from 'react';
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
    const ongoingTransaction = localStorage.getItem('ongoingTransaction');
    if (ongoingTransaction === 'true') {
      setIsSubmitting(true);
    }
  }, []);

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
    localStorage.setItem('ongoingTransaction', 'true');
    try {
      const shift = await getLastIndex() + 1;
      const added: number[] = await invoke('deposit', { addr: user!.addr, amount: depositAmount, shift: shift });
      await addIndexes(added);
      alert(`Deposit of ${depositAmount} was successful.`);
      localStorage.setItem('ongoingTransaction', 'false');
    } catch (e) {
      console.error(e);
      alert(`Failed to deposit: ${e}`);
      localStorage.setItem('ongoingTransaction', 'false');
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
    localStorage.setItem('ongoingTransaction', 'true');
    try {
      await invoke('withdraw', { addr: user!.addr, amount: withdrawAmount });
      alert(`Withdrawal of ${withdrawAmount} was successful.`);
      localStorage.setItem('ongoingTransaction', 'false');
    } catch (e) {
      console.error(e);
      alert(`Failed to withdraw: ${e}`);
      localStorage.setItem('ongoingTransaction', 'false');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.userInfoBox}>
          <h1 style={styles.userName}>{user?.name ?? 'Loading...'}</h1>
          <p style={styles.userDetail}>{user?.addr ?? 'Loading...'}</p>
          <p style={styles.userDetail}>{user?.ss58 ?? 'Loading...'}</p>
          {balance !== undefined && (
            <p style={styles.balanceAmount}>{`${balance} Tokens`}</p>
          )}
        </div>
        <button style={styles.backButton} onClick={handleBack}>Back to Entry Page</button>
      </div>

      <div style={styles.controlsSection}>
        <div style={styles.depositWithdrawSection}>
          <div style={styles.leftSection}>
            <div style={styles.controlGroup}>
              <select
                style={styles.select}
                value={depositAmount ?? ''}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                disabled={isSubmitting}
              >
                <option value="" disabled>Select amount</option>
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <button
                style={styles.actionButton}
                onClick={handleDeposit}
                disabled={isSubmitting || depositAmount === null}
              >
                {isSubmitting ? "Depositing..." : "Deposit"}
              </button>
            </div>
          </div>

          <div style={styles.rightSection}>
            <div style={styles.controlGroup}>
              <select
                style={styles.select}
                value={withdrawAmount ?? ''}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                disabled={isSubmitting}
              >
                <option value="" disabled>Select amount</option>
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <button
                style={styles.actionButton}
                onClick={handleWithdraw}
                disabled={isSubmitting || withdrawAmount === null}
              >
                {isSubmitting ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      </div>

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
                <p>Time: <span style={styles.timeText}>{new Date(Number(tx.time.toString().replace(/,/g, ''))).toLocaleString()}</span></p>
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
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    backgroundColor: '#f5f5f5', // Light gray background
    color: '#333333', // Dark text color
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    borderBottom: '1px solid #dddddd', // Light border color
    position: 'relative',
  },
  userInfoBox: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '1.2rem',
    color: '#000000', // Black text color
    margin: '0',
  },
  userDetail: {
    fontSize: '0.9rem',
    color: '#666666', // Medium gray text color
    margin: '2px 0',
  },
  balanceAmount: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#00aaff', // Blue text color
    marginTop: '10px',
  },
  backButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: '#eeeeee', // Light background color
    color: '#333333', // Dark text color
    border: '1px solid #cccccc', // Lighter border color
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Lighter shadow
  },
  controlsSection: {
    marginTop: '20px',
    textAlign: 'center',
  },
  depositWithdrawSection: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    maxWidth: '1500px',
    margin: '0 auto',
  },
  leftSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  rightSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  select: {
    padding: '10px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #cccccc', // Light border color
    backgroundColor: '#ffffff', // White background
    color: '#333333', // Dark text color
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Lighter shadow
    outline: 'none',
    appearance: 'none', // Remove default styling
  },
  selectOption: {
    backgroundColor: '#ffffff', // White background
    color: '#333333', // Dark text color
  },
  actionButton: {
    padding: '8px 16px',
    fontSize: '16px',
    backgroundColor: '#007bff', // Primary blue color
    color: '#ffffff', // White text color
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s, transform 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Lighter shadow
  },
  transactionSection: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    flex: 1,
    marginTop: '20px',
    overflow: 'hidden',
    flexGrow: 1,
  },
  transactionColumn: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff', // White background
    borderRadius: '8px',
    padding: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Lighter shadow
  },
  transactionList: {
    flex: 1,
    overflowY: 'auto',
  },
  transactionItem: {
    marginBottom: '10px',
    paddingBottom: '5px',
    borderBottom: '1px solid #dddddd', // Light border color
  },
  amountText: {
    color: '#00aaff', // Blue text color
    fontWeight: '600',
  },
  timeText: {
    color: '#666666', // Medium gray text color
  },
  subheading: {
    fontSize: '1.1rem',
    color: '#000000', // Black text color
    marginBottom: '10px',
    textAlign: 'center',
  },
};


export default UserPage;
