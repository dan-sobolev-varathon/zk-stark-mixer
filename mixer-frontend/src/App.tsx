import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import SignUp from './SignUp';
import { gearApiContext } from './context';
import { GearApi } from '@gear-js/api';
import OutletPage from './OutletPage.tsx';
import TablePage from './TablePage.tsx';
import MainPage from './MainPage.tsx';

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
      if (gearApi !== undefined) {
        gearApi.disconnect();
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
          <Route path="/entry" element={<MainPage />}>
            <Route path="user/:userId" element={<TablePage />} />
          </Route>
        </Routes>
      </Router>
    </gearApiContext.Provider>
  );
};

export default App;
