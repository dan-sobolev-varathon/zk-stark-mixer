import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyPassword } from '../utils/PasswordVerification';
import { invoke } from '@tauri-apps/api';
import { db, getIndexes, getUsers, IIndex, IUser } from '../utils/IndexedDB';
import { HexString } from '@gear-js/api';

const reset = async () => {
  localStorage.removeItem('mixingAmount');
  localStorage.removeItem('mixingFrom');
  console.log("AAAAAAAAAAAAAA")
  await db.indexes.clear();
  await db.transactions.clear();
};

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [contract, setContract] = useState<string>();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Try to get the contract from localStorage on component mount
    const savedContract = localStorage.getItem('contract') as string;
    if (savedContract) {
      setContract(savedContract);
    }
  }, []);

  const handleLogin = async () => {
    if (await verifyPassword(password)) {
      let isChanged = false;

      let finalContract: string = '';

      const savedContract = localStorage.getItem('contract') as string;

      if((contract === undefined || contract === '') && savedContract !== null){
        finalContract = savedContract;
      }
      else{
        if(contract !== undefined && savedContract === null){
          finalContract = contract;
          isChanged = true
        }
        else{
          if(contract !== undefined && savedContract !== null){
            finalContract = contract;
            if(contract !== savedContract){
              isChanged = true;
            }
          }
          else{
            setError('Please enter a contract in string format.');
            setTimeout(() => setError(''), 3000);
            return;
          }
        }
      }

      let users: IUser[] = await getUsers();
      let addresses = users.map(x => x.addr);
      let indexes = await getIndexes();

      if(isChanged){
        indexes = [];
      }

      try {
        await invoke('activate_accounts', { addresses, password, indexes, contract: finalContract.slice(2) });
        globalThis.MIXING_CONTRACT_ADDRESS = finalContract as HexString;
        if(isChanged){
          await reset();
          localStorage.setItem('contract', finalContract);
        }
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
          onChange={(e) => setContract(e.target.value as string)}
          placeholder="Enter contract in string format"
          style={{ width: '300px' }}
        />
      </div>
    </div>
  );
};

export default Login;
