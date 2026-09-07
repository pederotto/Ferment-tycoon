import React from 'react';
import { STAFF_ROLES } from '../constants';
import { StaffRoleType } from '../types';
import { CloseIcon, StaffGroupIcon, getStaffIcon } from './icons';

interface StaffManagerProps {
  onClose: () => void;
  activeStaff: Record<StaffRoleType, boolean>;
  money: number;
  onHire: (roleId: StaffRoleType) => void;
  onFire: (roleId: StaffRoleType) => void;
}

const StaffManager: React.FC<StaffManagerProps> = ({ onClose, activeStaff, money, onHire, onFire }) => {
  const totalWages = STAFF_ROLES.reduce((acc, role) => activeStaff[role.id] ? acc + role.weeklyWage : acc, 0);
  const activeCount = STAFF_ROLES.filter(role => activeStaff[role.id]).length;

  return (
    <div className="modal-overlay">
      <div className="backdrop-blurscene">
        <div className="ghost-cubby" /><div className="ghost-cubby" /><div className="ghost-cubby" /><div className="ghost-cubby" />
      </div>

      <div className="ledger" style={{ width: 'min(1080px, 94vw)', height: 'min(660px, 88vh)' }}>
        <div className="corner c-tl" /><div className="corner c-tr" /><div className="corner c-bl" /><div className="corner c-br" />

        <div className="lhead">
          <div className="ttl-row">
            <div className="ic"><StaffGroupIcon size={18} /></div>
            <div>
              <h1 className="slab">Laboratory Personnel</h1>
              <div className="sub">Retain specialists to automate sanitation, monitoring &amp; quality control</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="payroll">
              <div className="l">Active {activeCount}/{STAFF_ROLES.length} &middot; Weekly Payroll</div>
              <div className="v mono">&minus;${totalWages} / wk</div>
            </div>
            <button onClick={onClose} className="close-stamp" style={{ marginLeft: 20 }} title="Close">
              <CloseIcon size={13} />
            </button>
          </div>
        </div>

        <div className="roster custom-scrollbar" style={{ gridTemplateRows: 'auto auto' }}>
          {STAFF_ROLES.map(role => {
            const isHired = activeStaff[role.id];
            const canAfford = money >= role.hiringCost;
            const RoleIcon = getStaffIcon(role.id);

            return (
              <div key={role.id} className={`role-card${isHired ? ' active' : ''}`}>
                <div className="role-top">
                  <div className="role-left">
                    <div className="role-ic"><RoleIcon size={20} /></div>
                    <div>
                      <div className="role-name">{role.name}</div>
                      <div className="role-wage">
                        <span className="wage-tag">${role.weeklyWage}/wk</span>
                        {!isHired && <span className="onboard-tag">Onboarding ${role.hiringCost}</span>}
                      </div>
                    </div>
                  </div>
                  <span className={`status-pill ${isHired ? 'active' : 'vacant'}`}>{isHired ? 'Active' : 'Vacant'}</span>
                </div>

                <div className="role-desc">{role.effectDescription}</div>

                {isHired ? (
                  <button onClick={() => onFire(role.id)} className="role-action dismiss">Dismiss Contract</button>
                ) : (
                  <button
                    onClick={() => onHire(role.id)}
                    disabled={!canAfford}
                    className="role-action hire"
                    style={!canAfford ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  >
                    {canAfford ? `Hire for $${role.hiringCost}` : 'Insufficient Treasury Funds'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StaffManager;
