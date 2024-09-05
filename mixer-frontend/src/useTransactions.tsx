import { useState, useEffect, useRef, useContext } from 'react';
import { getTransactions, addTransactions, ITransaction } from './utils/IndexedDB';
import { HexString, ProgramMetadata, UserMessageSent } from '@gear-js/api';
// import { MIXING_CONTRACT_ADDRESS, MIXING_META } from './consts';
import { gearApiContext } from './context';
import { UnsubscribePromise } from '@polkadot/api/types';
import PQueue from 'p-queue';
import { MIXING_META } from './consts';

export const useTransactions = (userId: HexString | undefined) => {
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [from, setFrom] = useState<number | undefined>(undefined);
  const [meta, setMeta] = useState<ProgramMetadata | undefined>(undefined);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const gearApi = useContext(gearApiContext);
  const fromRef = useRef(from);
  const [isFirstRead, setIsFirstRead] = useState(true);
  const queueRef = useRef(new PQueue({ concurrency: 1 }));

  useEffect(() => {
    if (!userId) return;

    setTransactions([]);
    setIsFirstRead(true);
    setFrom(undefined);

    const init = async () => {
      const all_transactions = await getTransactions(userId);
      setTransactions(all_transactions);
      setFrom(all_transactions.length);
      fromRef.current = all_transactions.length;

      setMeta(ProgramMetadata.from(MIXING_META));
      setIsInitialized(true);
    };

    void init();
  }, [userId]);

  useEffect(() => {
    if (!from) return;
    fromRef.current = from;
  }, [from]);

  useEffect(() => {
    if (!isInitialized || gearApi === undefined || fromRef.current === undefined || meta === undefined || userId === undefined) return;

    const firstRead = async () => {
      const programId = globalThis.MIXING_CONTRACT_ADDRESS;
      const payload = { HistoryOneFrom: { user: userId, from: fromRef.current } };

      const codecState = await gearApi.programState.read({ programId, payload }, meta);
      const result = codecState.toJSON() as { historyOneFrom: { res: { amount: number, time: number }[] } };

      const new_transactions: ITransaction[] = result.historyOneFrom.res.map(a => ({ addr: userId, amount: a.amount, time: a.time }));

      setTransactions(prev => [...prev, ...new_transactions]);
      await addTransactions(new_transactions);
      setFrom(prev => prev! + new_transactions.length);
      fromRef.current = fromRef.current! + new_transactions.length;
    };

    if (isFirstRead) {
      // void firstRead();
      queueRef.current.add(async () => await firstRead());
      setIsFirstRead(false);
    }

    const handleEvent = async (event: UserMessageSent) => {
      const { message } = event.data;
      const { source, destination } = message;

      const destinationHex = destination.toHex();
      const sourceHex = source.toHex();

      if (destinationHex !== userId || sourceHex !== globalThis.MIXING_CONTRACT_ADDRESS) return;

      const programId = globalThis.MIXING_CONTRACT_ADDRESS;
      const payload = { HistoryOneFrom: { user: destinationHex, from: fromRef.current } };

      const codecState = await gearApi.programState.read({ programId, payload }, meta);
      const result = codecState.toJSON() as { historyOneFrom: { res: { amount: number, time: number }[] } };

      const new_transactions: ITransaction[] = result.historyOneFrom.res.map(a => ({ addr: userId, amount: a.amount, time: a.time }));

      setTransactions(prev => [...prev, ...new_transactions]);
      await addTransactions(new_transactions);
      setFrom(prev => prev! + new_transactions.length);
      fromRef.current = fromRef.current! + new_transactions.length;
    };

    const unsubs: UnsubscribePromise[] = [];

    const subscribeToEvents = async () => {
      const unsub = gearApi.gearEvents.subscribeToGearEvent(
        "UserMessageSent",
        (event) => {
          queueRef.current.add(async () => await handleEvent(event));
          // await handleEvent(event);
        });
      unsubs.push(unsub);
    };

    void subscribeToEvents();

    return () => {
      if (unsubs.length) {
        Promise.all(unsubs).then((result) => {
          result.forEach((unsubscribe) => unsubscribe());
        });
      }
    };
  }, [gearApi, isInitialized, userId]);

  return { transactions };
};
