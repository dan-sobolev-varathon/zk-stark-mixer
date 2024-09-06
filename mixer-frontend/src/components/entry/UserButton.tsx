import React from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // Import navigate hook and useParams
import { IUser } from '../../utils/IndexedDB';
import { useBalance } from '../../hooks/useBalance'; // Custom hook to fetch the balance

interface UserButtonProps {
    user: IUser;
    onExport: (user: IUser) => void;
}

const UserButton: React.FC<UserButtonProps> = ({ user, onExport }) => {
    const { balance } = useBalance(user.addr); // Fetch the user's balance using a custom hook
    const navigate = useNavigate(); // Use the navigate function from react-router-dom
    const { userId } = useParams<{ userId: string }>(); // Get the selected userId from URL params

    const handleExport = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation(); // Prevent triggering navigation when clicking the Export button
        onExport(user);
    };

    // Handle user button click: navigate to the user's page
    const handleUserClick = () => {
        navigate(`/entry/user/${user.addr}`); // Navigate to the user-specific route
    };

    // Check if the current button is selected (matches the userId in the URL)
    const isSelected = userId === user.addr;

    return (
        <div
            style={{
                ...styles.container,
                backgroundColor: isSelected ? '#d0eaff' : '#f9f9f9', // Highlight selected user
                borderColor: isSelected ? '#007bff' : '#ccc', // Highlight border
            }}
            onClick={handleUserClick}
        >
            <div style={styles.userInfo}>
                <p style={styles.infoText}><strong>Name:</strong> {user.name}</p>
                <p style={styles.infoText}><strong>Addr:</strong> {user.addr}</p>
                {/* <p style={styles.infoText}><strong>SS58:</strong> {user.ss58}</p> */}
                <p style={styles.infoText}><strong>Balance:</strong> {balance}</p>
            </div>
            <button style={styles.exportButton} onClick={handleExport}>
                Export
            </button>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        position: 'relative', // For positioning the export button
        padding: '5px', // Reduced padding for more compactness
        backgroundColor: '#f9f9f9',
        borderRadius: '5px',
        border: '1px solid #ccc',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, border-color 0.3s',
        maxWidth: '100%',
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px', // Reduced gap between info lines for compactness
        fontSize: '12px',
        color: '#333',
    },
    infoText: {
        margin: 0, // Remove default margins from paragraphs
        wordBreak: 'break-word', // Ensure long strings wrap to the next line
    },
    exportButton: {
        position: 'absolute',
        top: '5px',
        right: '5px',
        padding: '2px 4px', // Smaller padding to make the button smaller
        fontSize: '10px', // Smaller font size for compactness
        backgroundColor: '#007bff', // Blue button color
        color: '#ffffff', // White text color
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, transform 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Light shadow
    },
};

export default UserButton;
