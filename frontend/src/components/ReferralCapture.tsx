import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { captureReferral } from '../referral';

export default function ReferralCapture() {
  const { search } = useLocation();
  const { auth } = useAuth();
  useEffect(() => { captureReferral(search, !!auth); }, [search, auth]);
  return null;
}
