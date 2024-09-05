import React from 'react';
import { useParams } from 'react-router-dom';
import TablePage from './TablePage';

const TablePageWithKey: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  return <TablePage key={userId} />;
};

export default TablePageWithKey;
