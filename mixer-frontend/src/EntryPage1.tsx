import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/tauri";
import { verifyPassword } from './utils/PasswordVerification';
import { writeFile, createDir } from '@tauri-apps/api/fs';
import { homeDir } from '@tauri-apps/api/path';
import { addUser, getUsers, IUser } from './utils/IndexedDB';
import { GearApi, HexString, MessagesDispatched, ProgramMetadata } from '@gear-js/api';
import { ApiBase, UnsubscribePromise } from '@polkadot/api/types';
import { MIXING_CONTRACT_ADDRESS, MIXING_META } from './consts';
import { hexToU8a } from '@polkadot/util';
import { gearApiContext } from './context';
import PQueue from 'p-queue';

type ByteArray32 = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

const EntryPage: React.FC = () => {
    const [users, setUsers] = useState<IUser[]>([]);
    const [mixingAmount, setMixingAmount] = useState<number | undefined>(undefined);
    const [from, setFrom] = useState<number | undefined>(undefined);
    const fromRef = useRef(from);

    const [meta, setMeta] = useState<ProgramMetadata | undefined>(undefined);

    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!from) return;
        fromRef.current = from;
        localStorage.setItem('mixingFrom', from.toString());
    }, [from]);

    const gearApi = useContext(gearApiContext);

    useEffect(() => {
        const initt = async () => {
            const mixingAmount0 = localStorage.getItem('mixingAmount');
            if (!mixingAmount0) {
                const init = 0;
                localStorage.setItem('mixingAmount', init.toString());
                setMixingAmount(init);
            }
            else {
                setMixingAmount(parseInt(mixingAmount0));
            }
            const from0 = localStorage.getItem('mixingFrom');
            if (!from0) {
                const init = 0;
                localStorage.setItem('mixingFrom', init.toString());
                setFrom(init);
                fromRef.current = init;
            }
            else {
                const from1 = parseInt(from0);
                setFrom(from1);
                fromRef.current = from1;
            }
            const users0 = await getUsers();
            setUsers(users0);

            setMeta(ProgramMetadata.from(MIXING_META));

            setIsInitialized(true);
        }
        void initt();
    }, []);

    const [isFirstRead, setIsFirstRead] = useState(true);
    const queueRef = useRef(new PQueue({ concurrency: 1 }));

    useEffect(() => {
        if (!isInitialized) return;
        if (gearApi === undefined || from === undefined || meta === undefined) return;

        const firstRead = async () => {
            const codecState = await gearApi.programState.read({ programId: MIXING_CONTRACT_ADDRESS, payload: { Withdrawn: { from: fromRef.current } } }, meta);
            const result = codecState.toJSON() as { withdrawn: { res: string[] } };

            console.log(result.withdrawn.res)

            let data = result.withdrawn.res.map(a => Array.from(hexToU8a(a)) as ByteArray32);

            console.log(data);

            const amount: number = await invoke('check_mixing', { data: data });
            console.log(amount)
            if (mixingAmount !== amount) {
                setMixingAmount(amount);
                localStorage.setItem('mixingAmount', amount.toString());
            }
            setFrom(prev => {
                return prev! + result.withdrawn.res.length
            })
        }

        if (isFirstRead) {
            void firstRead();
            setIsFirstRead(false);
        }

        const handleEvent = async (data: MessagesDispatched) => {
            const changedIDs = data.data.stateChanges.toHuman() as HexString[];
            const isAnyChange = changedIDs.some((id) => id === MIXING_CONTRACT_ADDRESS);

            if (isAnyChange) {
                const codecState = await gearApi.programState.read({ programId: MIXING_CONTRACT_ADDRESS, payload: { Withdrawn: { from: fromRef.current } } }, meta);
                const result = codecState.toJSON() as { withdrawn: { res: string[] } };

                console.log(result.withdrawn.res)
                let data = result.withdrawn.res.map(a => Array.from(hexToU8a(a)) as ByteArray32);

                console.log(data);
                const amount = await invoke('check_mixing', { data: data }) as number;
                if (mixingAmount !== amount) {
                    setMixingAmount(amount);
                    localStorage.setItem('mixingAmount', amount.toString());
                }
                setFrom(prev => {
                    return prev! + result.withdrawn.res.length
                })
            }
        };

        const unsubs: UnsubscribePromise[] = [];

        const subscribeToEvents = async () => {
            const unsub = gearApi.gearEvents.subscribeToGearEvent(
                "MessagesDispatched",
                async (data) => {
                    // queueRef.current.add(() => handleEvent(data));
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
    }, [gearApi, isInitialized])

    const [userName, setUserName] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [importJson, setImportJson] = useState('');
    const [importPassword, setImportPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');
        setUsers(storedUsers);
    }, []);

    const handleAddUser = async () => {
        if (!userName) {
            setErrorMessage('Please enter username');
            return;
        }
        try {
            const [addr, ss58]: [HexString, string] = await invoke('create_new_account');

            const newUser: IUser = { addr, ss58, name: userName };
            const newUsers = [...users, newUser];
            setUsers(newUsers);
            await addUser(newUser);

            setUserName('');
            setErrorMessage(null);
        } catch (e) {
            console.error('Error in create_new_account', e);
            setErrorMessage('An error occurred while creating the account.');
        }
    };

    const goToUserPage = (user: IUser) => {
        navigate(`/user/${user.addr}`);
    };

    const handleGetAllAccounts = async () => {
        try {
            const accounts: string[] = await invoke('get_all_accounts');
            console.log('All Accounts:', accounts);
        } catch (e) {
            console.error('Error in get_all_accounts', e);
        }
    };

    const handleExportAccount = async (user: IUser) => {
        try {
            const accountData: string = await invoke('export_account', { addr: user.addr, name: user.name });
            const fileName = `exported_account_${user.addr}.json`;
            const home = await homeDir();
            const dirPath = `${home}/exported_accounts`;

            await createDir(dirPath, { recursive: true });

            const filePath = `${dirPath}/${fileName}`;

            await writeFile(filePath, accountData);
            console.log(`Account exported to file: ${filePath}`);
        } catch (e) {
            console.error('Error in export_account', e);
            setErrorMessage('An error occurred while exporting the account.');
        }
    };

    const handleImportAccount = async () => {
        if (!importJson || !importPassword) {
            setErrorMessage('Please enter both JSON data and password.');
            return;
        }
        try {
            const [addr, ss58, name]: [HexString, string, string] = await invoke('import_account', { jsonEncodedPair: importJson, password: importPassword });

            const importedUser: IUser = { addr, name, ss58 };
            const newUsers = [...users, importedUser];
            setUsers(newUsers);

            await addUser(importedUser);

            setImportJson('');
            setImportPassword('');
            setErrorMessage(null);
        } catch (e) {
            console.error('Error in import_account', e);
            setErrorMessage('An error occurred while importing the account.');
        }
    };

    return (
        <div>
            <h1>Entry Page</h1>
            {users.map((user, index) => (
                <div key={index}>
                    <button onClick={() => goToUserPage(user)}>
                        {user.name} ({user.addr})
                    </button>
                    <button onClick={() => handleExportAccount(user)}>Export Account</button>
                </div>
            ))}
            <div>
                <input
                    type="text"
                    placeholder="Enter user name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                />
                <button onClick={handleAddUser}>Add New User</button>
                <button onClick={handleGetAllAccounts}>Get All Accounts</button>
                <input
                    type="text"
                    placeholder="Enter JSON encoded data"
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Enter import password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                />
                <button onClick={handleImportAccount}>Import Account</button>
                {errorMessage && (
                    <div style={{
                        color: 'red',
                        marginTop: '10px',
                        backgroundColor: 'lightcoral',
                        padding: '10px',
                        borderRadius: '5px'
                    }}>
                        {errorMessage}
                    </div>
                )}
            </div>
            <div>Mixing amount {mixingAmount}, Mixing from {from}</div>
        </div>
    );
};

export default EntryPage;
