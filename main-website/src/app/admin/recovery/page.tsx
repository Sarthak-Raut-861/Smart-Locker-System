"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Eye, 
  UserCheck, 
  Lock, 
  X, 
  FileText, 
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import { EmergencyRecoveryRecord, RecoveryStatus, RiskState } from '@/lib/recovery/recoveryTypes';

export default function AdminEmergencyRecoveryPage() {
  const [requests, setRequests] = useState<EmergencyRecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<EmergencyRecoveryRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recovery/requests');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching recovery requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const handleAdminAction = async (newStatus: 'APPROVED' | 'DENIED' | 'BLOCKED') => {
    if (!selectedRecord) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/recovery/admin-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedRecord.id,
          status: newStatus,
          notes: reviewNotes || 'Physical station identity verification evaluated by support staff.',
          adminEmail: 'support@locknleave.railway',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRecord(null);
        setReviewNotes('');
        await fetchRequests();
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to submit review');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.lockerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.bookingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.passengerName && req.passengerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.pnr && req.pnr.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: RecoveryStatus) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
      case 'USED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Used</span>;
      case 'VERIFICATION_REQUIRED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">Verifying</span>;
      case 'MANUAL_REVIEW':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">Manual Review</span>;
      case 'BLOCKED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-950 text-red-400 border border-red-800">Blocked</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">Expired</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-gray-300">{status}</span>;
    }
  };

  const getRiskBadge = (risk: RiskState) => {
    switch (risk) {
      case 'LOW':
        return <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Low</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Medium</span>;
      case 'HIGH':
      case 'BLOCKED':
        return <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> High Risk</span>;
      default:
        return <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Normal</span>;
    }
  };

  const kpis = {
    total: requests.length,
    active: requests.filter(r => r.status === 'APPROVED').length,
    review: requests.filter(r => r.status === 'MANUAL_REVIEW' || r.status === 'BLOCKED').length,
    completed: requests.filter(r => r.status === 'USED').length,
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-3xl font-black text-white font-outfit uppercase italic tracking-tight">
              Emergency Recovery Helpline
            </h1>
          </div>
          <p className="text-gray-400 text-xs font-medium">
            Monitor and audit passenger lost-phone recovery workflows across railway coach lockers.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          Refresh Requests
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Requests</div>
          <div className="text-3xl font-black text-white font-outfit">{kpis.total}</div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Active PINs Issued</div>
          <div className="text-3xl font-black text-emerald-400 font-outfit">{kpis.active}</div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-rose-400 text-[10px] font-bold uppercase tracking-widest mb-1">Manual Review / Blocked</div>
          <div className="text-3xl font-black text-rose-400 font-outfit">{kpis.review}</div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl">
          <div className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-1">Successfully Used</div>
          <div className="text-3xl font-black text-cyan-400 font-outfit">{kpis.completed}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card border border-border p-4 rounded-2xl">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Request ID, Locker, Booking, PNR..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'VERIFICATION_REQUIRED', 'APPROVED', 'MANUAL_REVIEW', 'USED', 'EXPIRED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                statusFilter === st
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-gray-500">
                <th className="p-4 pl-6">Request ID</th>
                <th className="p-4">Locker</th>
                <th className="p-4">Passenger &amp; Booking</th>
                <th className="p-4">Status</th>
                <th className="p-4">Risk State</th>
                <th className="p-4">Attempts</th>
                <th className="p-4">Created / Expires</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 font-medium">
                    No emergency recovery requests matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 pl-6 font-mono font-bold text-gray-300">
                      {req.id}
                    </td>
                    <td className="p-4">
                      <span className="font-outfit font-black text-white text-sm">
                        #{req.lockerId}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">{req.passengerName || 'N/A'}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {req.bookingId} {req.pnr ? `• ${req.pnr}` : ''}
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="p-4">
                      {getRiskBadge(req.riskState)}
                    </td>
                    <td className="p-4 font-mono text-gray-400">
                      {req.failedAttempts || 0} / {req.maxAttempts || 3}
                    </td>
                    <td className="p-4 text-gray-400 text-[11px]">
                      <div>{new Date(req.createdAt).toLocaleTimeString()}</div>
                      {req.expiresAt && req.status === 'APPROVED' && (
                        <div className="text-amber-400 font-bold text-[10px] mt-0.5">
                          Exp: {new Date(req.expiresAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => setSelectedRecord(req)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-[11px] font-bold transition-all inline-flex items-center gap-1.5 border border-white/5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Modal / Inspection Drawer */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f172a] border border-border w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase tracking-wider text-primary">
                      Recovery Inspection
                    </span>
                    {getStatusBadge(selectedRecord.status)}
                  </div>
                  <h3 className="text-xl font-black text-white font-outfit uppercase">
                    Request {selectedRecord.id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Record Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Target Unit</div>
                  <div className="text-lg font-black text-white font-outfit mt-0.5">Locker #{selectedRecord.lockerId}</div>
                </div>
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Passenger</div>
                  <div className="text-sm font-bold text-white mt-0.5 truncate">{selectedRecord.passengerName}</div>
                </div>
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Booking ID</div>
                  <div className="text-xs font-mono font-bold text-gray-300 mt-1 truncate">{selectedRecord.bookingId}</div>
                </div>
              </div>

              {/* Verification Metadata */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" /> Identity Verification Status
                </h4>
                {selectedRecord.identityVerification ? (
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>Provider: <strong className="text-white">{selectedRecord.identityVerification.provider}</strong></div>
                    <div>Ref ID: <span className="font-mono text-gray-300">{selectedRecord.identityVerification.referenceId}</span></div>
                    <div>Name Match: <strong className="text-emerald-400">{((selectedRecord.identityVerification.nameMatchConfidence || 0) * 100).toFixed(0)}%</strong></div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400">Identity verification pending or not yet passed.</p>
                )}
              </div>

              {/* Immutable Audit Trail */}
              <div className="mb-6 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Audit Trail ({selectedRecord.auditTrail?.length || 0} events)
                </h4>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-3 font-mono text-[11px]">
                  {selectedRecord.auditTrail?.map((evt, idx) => (
                    <div key={idx} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-gray-400 text-[10px]">
                        <span className="font-bold text-primary">[{evt.actor}] {evt.eventType}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-gray-300 text-xs mt-0.5">{evt.details || evt.result}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support Staff Action Workflow (Complies with Rule: NO blind Unlock button) */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-left">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4" /> Station TTE / Staff Review Workflow
                </h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Support staff must verify passenger&apos;s physical identification and coach ticket before updating state. Direct unlock bypass is restricted.
                </p>

                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter station review notes (e.g. Physical Aadhaar card inspected by TTE Sharma)..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 mb-3"
                  rows={2}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminAction('DENIED')}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase transition-all"
                  >
                    Deny Request
                  </button>
                  <button
                    onClick={() => handleAdminAction('BLOCKED')}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold uppercase transition-all"
                  >
                    Block Request
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
