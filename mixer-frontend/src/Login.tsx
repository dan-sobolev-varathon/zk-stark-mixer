import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPassword } from './utils/PasswordVerification';
import { invoke } from '@tauri-apps/api';
import { getIndexes, getUsers, IIndex, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [contract, setContract] = useState<HexString>('0x');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Try to get the contract from localStorage on component mount
    const savedContract = localStorage.getItem('contract') as HexString;
    if (savedContract) {
      setContract(savedContract);
    }
  }, []);

  const handleLogin = async () => {
    if (await verifyPassword(password)) {
      let users: IUser[] = await getUsers();
      let addresses = users.map(x => x.addr);
      let indexes = await getIndexes();

      let finalContract = contract;

      // If contract input is empty, try getting from localStorage
      if (contract === '0x') {
        const savedContract = localStorage.getItem('contract') as HexString;
        if (savedContract !== null) {
          finalContract = savedContract;
        } else {
          // If no contract in localStorage, set an error
          setError('Please enter a contract in HexString format.');
          setTimeout(() => setError(''), 3000);
          return;
        }
      }

      // Save the contract in localStorage for future logins
      localStorage.setItem('contract', finalContract);

      try {
        await invoke('activate_accounts', { addresses, password, indexes, contract: finalContract });
        navigate('/entry');
        setPassword('');
      } catch (e) {
        alert(`Error in activate_accounts: ${e}`);
      }
    } else {
      setError('Incorrect password!');
      setTimeout(() => setError(''), 3000);  // clear the error after 3 seconds
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter your password"
      />
      <button onClick={handleLogin}>Login</button>
      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
      
      {/* Contract Input Field */}
      <div style={{ position: 'absolute', right: '10px', bottom: '10px' }}>
        <input
          type="text"
          value={contract}
          onChange={(e) => setContract(e.target.value as HexString)}
          placeholder="Enter contract in HexString format"
          style={{ width: '300px' }}
        />
      </div>
    </div>
  );
};

export default Login;
