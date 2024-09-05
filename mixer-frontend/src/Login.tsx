import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPassword } from './utils/PasswordVerification';
import { invoke } from '@tauri-apps/api';
import { getIndexes, getUsers, IIndex, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (await verifyPassword(password)) {
      let users: IUser[] = await getUsers();
      let addresses = users.map(x => x.addr);
      let indexes = await getIndexes();

      try {
        await invoke('activate_accounts', { addresses, password, indexes });
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
    </div>
  );
};

export default Login;
