import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CattleList from '../components/Cattle/CattleList';
import CattleForm from '../components/Cattle/CattleForm';
import CattleDetail from '../components/Cattle/CattleDetail';

function CattlePage() {
  return (
    <Routes>
      <Route index element={<CattleList />} />
      <Route path="new" element={<CattleForm />} />
      <Route path=":id" element={<CattleDetail />} />
    </Routes>
  );
}

export default CattlePage;
