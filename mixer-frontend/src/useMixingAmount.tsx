import { useState, useEffect, useRef, useContext } from 'react';
import { invoke } from "@tauri-apps/api/tauri";
import { ProgramMetadata, MessagesDispatched } from '@gear-js/api';
import { ApiBase, UnsubscribePromise } from '@polkadot/api/types';
import { MIXING_CONTRACT_ADDRESS, MIXING_META } from './consts';
import { hexToU8a } from '@polkadot/util';
import { gearApiContext } from './context';

type ByteArray32 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export const useMixingAmount = () => {
    const [mixingAmount, setMixingAmount] = useState<number | undefined>(undefined);
    const [isInitialized, setIsInitialized] = useState(false);
    const [meta, setMeta] = useState<ProgramMetadata | undefined>(undefined);
    const [from, setFrom] = useState<number | undefined>(undefined);
    const fromRef = useRef(from);
    const [isFirstRead, setIsFirstRead] = useState(true);

    const gearApi = useContext(gearApiContext);

    useEffect(() => {
        if (!from) return;
        fromRef.current = from;
        localStorage.setItem('mixingFrom', from.toString());
    }, [from]);

    useEffect(() => {
        const init = async () => {
            const mixingAmount0 = localStorage.getItem('mixingAmount');
            if (!mixingAmount0) {
                const initAmount = 0;
                localStorage.setItem('mixingAmount', initAmount.toString());
                setMixingAmount(initAmount);
            } else {
                setMixingAmount(parseInt(mixingAmount0));
            }
            const from0 = localStorage.getItem('mixingFrom');
            if (!from0) {
                const initFrom = 0;
                localStorage.setItem('mixingFrom', initFrom.toString());
                setFrom(initFrom);
                fromRef.current = initFrom;
            } else {
                const from1 = parseInt(from0);
                setFrom(from1);
                fromRef.current = from1;
            }
            setMeta(ProgramMetadata.from(MIXING_META));
            setIsInitialized(true);
        };

        void init();
    }, []);

    useEffect(() => {
        if (!isInitialized || gearApi === undefined || from === undefined || meta === undefined) return;

        const firstRead = async () => {
            const codecState = await gearApi.programState.read(
                { programId: MIXING_CONTRACT_ADDRESS, payload: { Withdrawn: { from: fromRef.current } } },
                meta
            );
            const result = codecState.toJSON() as { withdrawn: { res: string[] } };

            let data = result.withdrawn.res.map(a => Array.from(hexToU8a(a)) as ByteArray32);
            const amount: number = await invoke('check_mixing', { data: data });
            if (mixingAmount !== amount) {
                setMixingAmount(amount);
                localStorage.setItem('mixingAmount', amount.toString());
            }
            setFrom(prev => prev! + result.withdrawn.res.length);
        };

        if (isFirstRead) {
            void firstRead();
            setIsFirstRead(false);
        }

        const handleEvent = async (data: MessagesDispatched) => {
            const changedIDs = data.data.stateChanges.toHuman() as string[];
            const isAnyChange = changedIDs.some(id => id === MIXING_CONTRACT_ADDRESS);

            if (isAnyChange) {
                const codecState = await gearApi.programState.read(
                    { programId: MIXING_CONTRACT_ADDRESS, payload: { Withdrawn: { from: fromRef.current } } },
                    meta
                );
                const result = codecState.toJSON() as { withdrawn: { res: string[] } };
                let data = result.withdrawn.res.map(a => Array.from(hexToU8a(a)) as ByteArray32);
                const amount = await invoke('check_mixing', { data: data }) as number;
                if (mixingAmount !== amount) {
                    setMixingAmount(amount);
                    localStorage.setItem('mixingAmount', amount.toString());
                }
                setFrom(prev => prev! + result.withdrawn.res.length);
            }
        };

        const unsubs: UnsubscribePromise[] = [];

        const subscribeToEvents = async () => {
            const unsub = gearApi.gearEvents.subscribeToGearEvent(
                "MessagesDispatched",
                async (data) => {
                    await handleEvent(data);
                }
            );
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
    }, [gearApi, isInitialized]);

    return { mixingAmount };
};
