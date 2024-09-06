import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { encryptMarkerWithPassphrase } from '../utils/PasswordVerification';

const SignUp: React.FC = () => {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignUp = () => {
    void encryptMarkerWithPassphrase(password);
    navigate('/login');
  };

  return (
    <div>
      <h1>Set Your Password</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Enter a password"
      />
      <button onClick={handleSignUp}>Set Password</button>
    </div>
  );
};

export default SignUp;
