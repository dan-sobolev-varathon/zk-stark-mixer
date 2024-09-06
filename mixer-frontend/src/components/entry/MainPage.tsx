import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { getUsers, IUser, addUser, getLastIndex, addIndexes } from '../../utils/IndexedDB';
import { invoke } from '@tauri-apps/api/tauri';
import { writeFile, createDir } from '@tauri-apps/api/fs';
import { homeDir } from '@tauri-apps/api/path';
import { HexString } from '@gear-js/api';
import { useMixingAmount } from '../../hooks/useMixingAmount';
import UserButton from './UserButton';

const MainPage: React.FC = () => {
    const [users, setUsers] = useState<IUser[]>([]);
    const [userName, setUserName] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPassword, setImportPassword] = useState('');
    const [exportAmount, setExportAmount] = useState<number | undefined>(undefined);
    const [reinitMixingAmount, setReinitMixingAmount] = useState(true);
    const { mixingAmount, anonimityAmount } = useMixingAmount(reinitMixingAmount);
    const [activeTab, setActiveTab] = useState<'addUser' | 'importUser' | 'exportMixing' | 'importAmount'>('addUser');

    useEffect(() => {
        const init = async () => {
            const users0 = await getUsers();
            setUsers(users0);
        };
        void init();
    }, []);

    const handleAddUser = async () => {
        if (!userName) {
            alert('Please enter username');
            return;
        }
        try {
            const [addr, ss58]: [HexString, string] = await invoke('create_new_account');
            const newUser: IUser = { addr, ss58, name: userName };
            const newUsers = [...users, newUser];
            setUsers(newUsers);
            await addUser(newUser);
            setUserName('');
        } catch (e) {
            console.error('Error in create_new_account', e);
            alert(`An error occurred while creating the account: ${e}`);
        }
    };

    const handleImportAccount = async () => {
        if (!importFile || !importPassword) {
            alert('Please enter both JSON file and password.');
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
                    await addUser(importedUser);
                    setUsers(newUsers);
                } catch (e) {
                    console.error('Error in import_account', e);
                    alert(`An error occurred while importing the account: ${e}`);
                }
                setImportFile(null);
                setImportPassword('');
            };
            reader.readAsText(importFile);
        } catch (e) {
            console.error('Error reading file', e);
            alert(`An error occurred while reading the file:, ${e}`);
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
            alert(`Account exported to file: ${filePath}`);
        } catch (e) {
            console.error('Error in export_account', e);
            alert(`An error occurred while exporting the account: ${e}`);
        }
    };

    const handleExportMixing = async () => {
        if (exportAmount === undefined || exportAmount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        const a = localStorage.getItem('ongoingTransaction');
        if(a === 'true'){
            alert("Wait for completion");
            return;
        }
        
        try {
            // Call the Rust-side command to export mixing
            const exportedData: string = await invoke('export_mixing', { amount: exportAmount });
            
            const currentDate = new Date();
    
            // Create file name with the date
            const fileName = `exported_mixing_${exportAmount}_${currentDate.toUTCString()}.json`;

            const home = await homeDir();
            const dirPath = `${home}/exported_mixing`;
            await createDir(dirPath, { recursive: true });
            const filePath = `${dirPath}/${fileName}`;
            await writeFile(filePath, exportedData);
            
            alert(`Mixing amount exported to file: ${filePath}`);
        } catch (e) {
            console.error('Error in export_mixing', e);
            alert(`An error occurred while exporting the mixing amount: ${e}`);
        }
        setExportAmount(undefined);
    };
    

    const handleImportAmount = async () => {
        if (!importFile || !importPassword) {
            alert('Please enter both JSON file and password.');
            return;
        }
        const a = localStorage.getItem('ongoingTransaction');
        if(a === 'true'){
            alert("Wait for completion");
            return;
        }
    
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const shift = await getLastIndex() + 1;
                const encryptedStr = reader.result as string;
                
                try {
                    const old_amount_str = localStorage.getItem('mixingAmount');
                    let old_amount: number;
                    if (old_amount_str !== null){
                        old_amount = parseInt(old_amount_str);
                    }
                    else{
                        old_amount = 0;
                    }

                    const [amount, added]: [number, number[]] = await invoke('import_mixing', { encryptedStr, password: importPassword, shift: shift });
                    await addIndexes(added);

                    localStorage.setItem('mixingAmount', amount.toString());
                    setReinitMixingAmount((prev) => !prev);

                    alert(`Mixing amount imported successfully. Added new mixings: ${(amount - old_amount) * 10}`);
                } catch (e) {
                    console.error('Error in import_mixing', e);
                    alert(`An error occurred while importing the mixing amount: ${e}`);
                }
                setImportFile(null);
                setImportPassword('');
            };
            
            reader.readAsText(importFile);
        } catch (e) {
            console.error('Error reading file', e);
            alert(`An error occurred while reading the file: ${e}`);
        }
    };
    

    return (
        <div style={styles.container}>
            <div style={styles.sidebar}>
                <div style={styles.userList}>
                    {users.map((user, index) => (
                        <div key={index} style={styles.userItem}>
                            <UserButton user={user} onExport={handleExportAccount} />
                        </div>
                    ))}
                </div>

                <div style={styles.formContainer}>
                    {/* Tabs for Add User, Import User, Export Mixing, Import Amount */}
                    <div style={styles.tabContainer}>
                        <button onClick={() => setActiveTab('addUser')} style={activeTab === 'addUser' ? styles.activeTab : styles.tab}>
                            Add User
                        </button>
                        <button onClick={() => setActiveTab('importUser')} style={activeTab === 'importUser' ? styles.activeTab : styles.tab}>
                            Import User
                        </button>
                        <button onClick={() => setActiveTab('exportMixing')} style={activeTab === 'exportMixing' ? styles.activeTab : styles.tab}>
                            Export Mixing
                        </button>
                        <button onClick={() => setActiveTab('importAmount')} style={activeTab === 'importAmount' ? styles.activeTab : styles.tab}>
                            Import Amount
                        </button>
                    </div>

                    {/* Conditionally render the form based on activeTab */}
                    <div style={styles.formContent}>
                        {activeTab === 'addUser' && (
                            <div style={styles.addUserForm}>
                                <input
                                    type="text"
                                    placeholder="User name"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    style={styles.input}
                                />
                                <button onClick={handleAddUser} style={styles.button}>Add User</button>
                            </div>
                        )}

                        {activeTab === 'importUser' && (
                            <div style={styles.importUserForm}>
                                <input
                                    type="file"
                                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                                    style={styles.input}
                                    value={importFile ? undefined : ''}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={importPassword}
                                    onChange={(e) => setImportPassword(e.target.value)}
                                    style={styles.input}
                                />
                                <button onClick={handleImportAccount} style={styles.button}>Import User</button>
                            </div>
                        )}

                        {activeTab === 'exportMixing' && (
                            <div style={styles.exportMixingForm}>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={exportAmount || ''}
                                    onChange={(e) => setExportAmount(Number(e.target.value))}
                                    style={styles.input}
                                />
                                <button onClick={handleExportMixing} style={styles.button}>Export Mixing</button>
                            </div>
                        )}

                        {activeTab === 'importAmount' && (
                            <div style={styles.importUserForm}>
                                <input
                                    type="file"
                                    onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
                                    style={styles.input}
                                    value={importFile ? undefined : ''}
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={importPassword}
                                    onChange={(e) => setImportPassword(e.target.value)}
                                    style={styles.input}
                                />
                                <button onClick={handleImportAmount} style={styles.button}>Import Amount</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={styles.mainContent}>
                <div style={styles.topBar}>
                    <span style={styles.topBarItem}>Mixing amount: {mixingAmount !== undefined ? mixingAmount * 10 : undefined}</span>
                    <span style={styles.topBarItem}>Anonimity set: {anonimityAmount}</span>
                </div>
                <Outlet /> {/* This will render the child route content */}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
    },
    sidebar: {
        width: '40vw', // Smaller sidebar width
        backgroundColor: '#f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        borderRight: '1px solid #ccc', // Added border for cleaner separation
    },
    userList: {
        flexGrow: 1,
        overflowY: 'auto',
    },
    userItem: {
        padding: '10px',
        backgroundColor: '#ffffff',
        marginBottom: '10px',
        borderRadius: '4px',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
    formContainer: {
        marginTop: '10px',
    },
    tabContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        gap: '0px',
    },
    tab: {
        flex: 1,
        padding: '4px',
        cursor: 'pointer',
        backgroundColor: '#e0e0e0',
        border: '1px solid #ccc',
        textAlign: 'center',
        borderRadius: '4px',
        fontSize: '12px',
    },
    activeTab: {
        flex: 1,
        padding: '4px',
        cursor: 'pointer',
        backgroundColor: '#00aaff',
        color: '#fff',
        textAlign: 'center',
        borderRadius: '4px',
        fontSize: '12px',
    },
    formContent: {
        minHeight: '120px', // Fixed height for the form content
    },
    addUserForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    importUserForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    exportMixingForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    input: {
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontSize: '12px',
    },
    button: {
        padding: '8px',
        backgroundColor: '#00aaff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
    },
    mainContent: {
        flexGrow: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
    },
    topBar: {
        padding: '10px 0',
        paddingLeft: '20px',
        backgroundColor: '#f0f0f0',
        fontSize: '15px',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
    },
    topBarItem: {
        fontSize: '15px',
    },
};

export default MainPage;
