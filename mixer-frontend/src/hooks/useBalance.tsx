import { useState, useEffect, useContext } from 'react';
import { HexString } from '@gear-js/api';
import { gearApiContext } from '../context';
import { UnsubscribePromise } from '@polkadot/api/types';
import { Balance } from '@polkadot/types/interfaces';
import { formatBalance } from '@polkadot/util';

export const useBalance = (userId: HexString | undefined) => {
  const [balance, setBalance] = useState<string>();
  const [isFirstRead, setIsFirstRead] = useState(true);
  const gearApi = useContext(gearApiContext);

  useEffect(() => {
    if (!userId || !gearApi) return;

    const unsubs: UnsubscribePromise[] = [];

    const firstRead = async () => {
      const initialBalance = await gearApi.balance.findOut(userId); 
      const form = formatBalance(initialBalance);
      setBalance(form);
    };

    if (isFirstRead) {
      void firstRead();
      setIsFirstRead(false);
    }

    const subscribeToBalance = async () => {
      const unsub = gearApi.gearEvents.subscribeToBalanceChanges(userId, (newBalance) => {
        setBalance(formatBalance(newBalance));
      });

      unsubs.push(unsub);
    };

    subscribeToBalance();

    return () => {
      if (unsubs.length) {
        Promise.all(unsubs).then((result) => {
          result.forEach((unsubscribe) => unsubscribe());
        });
      }
    };
  }, [userId, gearApi, isFirstRead]);

  return { balance };
};
