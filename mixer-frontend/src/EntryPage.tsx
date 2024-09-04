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
    const [importFile, setImportFile] = useState<File | null>(null);
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

    const handleUserClick = (user: IUser) => {
        navigate(`/user/${user.addr}`);
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
        if (!importFile || !importPassword) {
            setErrorMessage('Please enter both JSON file and password.');
            return;
        }
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const jsonEncodedPair = reader.result as string;
                try {
                    const [addr, ss58, name]: [HexString, string, string] = await invoke('import_account', { jsonEncodedPair, password: importPassword });

                    const importedUser: IUser = { addr, name, ss58 };
                    const newUsers = [...users, importedUser];
                    setUsers(newUsers);

                    await addUser(importedUser);

                    setImportFile(null);
                    setImportPassword('');
                    setErrorMessage(null);
                } catch (e) {
                    console.error('Error in import_account', e);
                    setErrorMessage('An error occurred while importing the account.');
                }
            };
            reader.readAsText(importFile);
        } catch (e) {
            console.error('Error reading file', e);
            setErrorMessage('An error occurred while reading the file.');
        }
    };

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address).then(() => {
            alert('Address copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy address: ', err);
        });
    };

    return (
        <div style={styles.container}>
            <div style={styles.section}>
                <div style={styles.userList}>
                    {users.map((user, index) => (
                        <div 
                            key={index} 
                            style={styles.userItem}
                            onClick={() => handleUserClick(user)}
                        >
                            <div style={styles.userDetails}>
                                <span style={styles.userName}>{user.name}</span>
                                <span style={styles.userAddress}>{user.addr}</span>
                            </div>
                            <div style={styles.userActions}>
                                <button 
                                    style={styles.exportButton} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleExportAccount(user);
                                    }}
                                >
                                    Export
                                </button>
                                <button 
                                    style={styles.copyButton} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyAddress(user.addr);
                                    }}
                                >
                                    Copy Address
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.content}>
                <div style={styles.sectionLeft}>
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
                    </div>
                </div>

                <div style={styles.sectionRight}>
                    <h2 style={styles.subheading}>Import Account</h2>
                    <div style={styles.form}>
                        <input
                            type="file"
                            onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
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
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        backgroundColor: '#f5f5f5', // Light gray background
        color: '#333333', // Dark text color
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'auto',
    },
    section: {
        flex: 1,
        marginBottom: '30px',
        display: 'flex',
        flexDirection: 'column',
    },
    content: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    sectionLeft: {
        flex: 1,
        marginRight: '20px',
        display: 'flex',
        flexDirection: 'column',
    },
    sectionRight: {
        flex: 1,
        marginLeft: '20px',
        display: 'flex',
        flexDirection: 'column',
    },
    userList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflowY: 'auto',
        maxHeight: '60vh', // Increased height for the user list
    },
    userItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#ffffff', // White background
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
        cursor: 'pointer',
        transition: 'background-color 0.3s',
    },
    userItemHovered: {
        backgroundColor: '#f0f0f0', // Slightly gray background on hover
    },
    userDetails: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        marginRight: '10px',
    },
    userName: {
        color: '#00aaff', // Blue text color
        fontWeight: 'bold',
        marginBottom: '5px',
    },
    userAddress: {
        color: '#666666', // Medium gray text color
        fontSize: '0.9rem',
        wordWrap: 'break-word',
    },
    userActions: {
        display: 'flex',
        gap: '10px',
    },
    copyButton: {
        padding: '8px',
        fontSize: '12px',
        backgroundColor: '#28a745', // Green button color
        color: '#ffffff', // White text color
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
    },
    exportButton: {
        padding: '8px',
        fontSize: '12px',
        backgroundColor: '#007bff', // Blue button color
        color: '#ffffff', // White text color
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    input: {
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #cccccc', // Light border color
        backgroundColor: '#ffffff', // White background
        color: '#333333', // Dark text color
        boxSizing: 'border-box',
    },
    addButton: {
        padding: '10px',
        fontSize: '16px',
        backgroundColor: '#00aaff', // Blue button color
        color: '#ffffff', // White text color
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
    },
    importButton: {
        padding: '10px',
        fontSize: '16px',
        backgroundColor: '#007bff', // Blue button color
        color: '#ffffff', // White text color
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
    },
    errorMessage: {
        color: '#ffffff', // White text color
        backgroundColor: '#e57373', // Error red background
        padding: '10px',
        borderRadius: '4px',
        textAlign: 'center',
        marginTop: '10px',
    },
    mixingAmount: {
        textAlign: 'center',
        color: '#333333', // Dark text color
        fontWeight: 'bold',
        marginTop: '20px',
        fontSize: '1.2rem',
    },
};

export default EntryPage;
