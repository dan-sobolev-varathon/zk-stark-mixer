import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/tauri";
import { writeFile, createDir } from '@tauri-apps/api/fs';
import { homeDir } from '@tauri-apps/api/path';
import { addUser, getUsers, IUser } from './utils/IndexedDB';
import { HexString } from '@gear-js/api';
import { useMixingAmount } from './useMixingAmount';

const EntryPage: React.FC = () => {
    const [users, setUsers] = useState<IUser[]>([]);
    const { mixingAmount } = useMixingAmount();
    const [userName, setUserName] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [importJson, setImportJson] = useState('');
    const [importPassword, setImportPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const initt = async () => {
            const users0 = await getUsers();
            setUsers(users0);
        };
        void initt();
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
        <div style={styles.container}>
            <h1 style={styles.heading}>Entry Page</h1>
            <div style={styles.section}>
                <h2 style={styles.subheading}>Existing Users</h2>
                <div style={styles.userList}>
                    {users.map((user, index) => (
                        <div key={index} style={styles.userItem}>
                            <div style={styles.userDetails}>
                                <span style={styles.userName}>{user.name}</span>
                                <span style={styles.userAddress}>{user.addr}</span>
                            </div>
                            <button style={styles.exportButton} onClick={() => handleExportAccount(user)}>Export</button>
                            <button style={styles.userButton} onClick={() => goToUserPage(user)}>Go to User</button>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.section}>
                <h2 style={styles.subheading}>Add New User</h2>
                <div style={styles.form}>
                    <input
                        type="text"
                        placeholder="Enter user name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        style={styles.input}
                    />
                    <button style={styles.addButton} onClick={handleAddUser}>Add New User</button>
                    <button style={styles.getButton} onClick={handleGetAllAccounts}>Get All Accounts</button>
                </div>
            </div>

            <div style={styles.section}>
                <h2 style={styles.subheading}>Import Account</h2>
                <div style={styles.form}>
                    <input
                        type="text"
                        placeholder="Enter JSON encoded data"
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        style={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Enter import password"
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                        style={styles.input}
                    />
                    <button style={styles.importButton} onClick={handleImportAccount}>Import Account</button>
                </div>
            </div>

            {errorMessage && (
                <div style={styles.errorMessage}>
                    {errorMessage}
                </div>
            )}

            <div style={styles.mixingAmount}>Mixing amount: {mixingAmount}</div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        width: '100vw',
        height: '100vh',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#1e1e1e',
        color: '#f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'auto',
    },
    heading: {
        textAlign: 'center',
        color: '#fff',
        marginBottom: '20px',
    },
    section: {
        flex: 1,
        marginBottom: '30px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    subheading: {
        color: '#f0f0f0',
        marginBottom: '10px',
        borderBottom: '1px solid #444',
        paddingBottom: '5px',
    },
    userList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflowY: 'auto',
        maxHeight: '30vh',
    },
    userItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#333',
        borderRadius: '5px',
        boxShadow: '0px 0px 5px rgba(0, 0, 0, 0.5)',
    },
    userDetails: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        marginRight: '10px',
    },
    userName: {
        color: '#4CAF50',
        fontWeight: 'bold',
        marginBottom: '5px',
    },
    userAddress: {
        color: '#ddd',
        fontSize: '12px',
        wordWrap: 'break-word',
    },
    userButton: {
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        padding: '10px',
        fontSize: '14px',
        borderRadius: '5px',
        cursor: 'pointer',
        marginRight: '10px',
    },
    exportButton: {
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        padding: '10px',
        fontSize: '14px',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    input: {
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#f0f0f0',
        boxSizing: 'border-box',
    },
    addButton: {
        padding: '10px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    getButton: {
        padding: '10px',
        backgroundColor: '#FFC107',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    importButton: {
        padding: '10px',
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    errorMessage: {
        color: 'white',
        marginTop: '10px',
        backgroundColor: '#e57373',
        padding: '10px',
        borderRadius: '5px',
        textAlign: 'center',
    },
    mixingAmount: {
        textAlign: 'center',
        color: '#fff',
        fontWeight: 'bold',
    },
};

export default EntryPage;
