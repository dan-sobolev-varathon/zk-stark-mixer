import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import SignUp from './SignUp';
import EntryPage from './EntryPage.tsx';
import UserPage from './UserPage';
import { gearApiContext } from './context';
import { GearApi } from '@gear-js/api';

const useGearApi = (providerAddress: string) => {
  const [gearApi, setGearApi] = useState<GearApi>();

  useEffect(() => {
    const initializeGearApi = async () => {
      const api = await GearApi.create({
        providerAddress,
      });
      setGearApi(api);
    };

    void initializeGearApi();

    return () => {
      // Cleanup if necessary
      if (gearApi !== undefined) {
        gearApi.disconnect(); // Or any other cleanup required
      }
    };
  }, [providerAddress]);

  return gearApi;
};

const App: React.FC = () => {
  const checkPasswordSet = () => localStorage.getItem('passwordData') !== null;
  const gearApi = useGearApi('ws://localhost:9944');

  return (
    <gearApiContext.Provider value={gearApi}>
      <Router>
        <Routes>
          <Route path="/" element={checkPasswordSet() ? <Navigate to="/login" /> : <Navigate to="/signup" />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/user/:userId" element={<UserPage />} />
        </Routes>
      </Router>
    </gearApiContext.Provider>
  );
};

export default App;
